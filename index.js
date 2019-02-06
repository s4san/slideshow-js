(function() {
  'use strict';

  /**
   * NSSlideshow
   *
   * A utility to create slideshows out of any sequence of HTML elements
   * It works by using javascript to transition each element smoothly (60fps) from display: none to display: block
   *
   * To setup slideshow on your HTML, the following config needs to be set on the DOM elements
   *
   * Assumptions:
   *
   * Given a root element, the slideshow will include *all* siblings in slideshow until it encounters, data-slide-end='true'
   *
   * HTML Config:
   *
   * data-ns-slide=true - Indicates that the element is a participant in slideshow, note that
   *                      all of the elements with this attribute will have their display CSS property set to none;
   *                      It can cause some unintended side-effect, for example if used in conjunction with
   *                      `data-start-slide-show`
   * data-auto-schedule=true  - Signifies that the HTML element will appear on screen for some time and automatically
   *                           transition to next sibling.
   * data-step-into=CSSSelector  - Signifies that the element's children (that qualify the CSS Selector specified)
   *                                will be shown one at a time before moving on to next element. (Can be nested)
   * data-slide-end=true  - Signifies end of slideshow
   * data-start-slide-show=true  - This element will be considered the starting element of slideshow if no argument is passed to
   *                               NSSlideshow constructor.
   *
   * Events:
   *
   * Emits the following custom events to indicate status of the slideshow
   *
   * ns-slide-show-next - When a transition from one slide to another is complete
   * ns-slide-show-end - When slideshow ends
   *
   */

  // HTML Attributes
  const AUTO_SCHEDULE_ATTR = 'data-auto-schedule';
  const STEP_INTO_ATTR = 'data-step-into';
  const BACK_ATTR = 'data-ns-back-target';

  // JS Variables for CSS Classes/selectors
  const show = 'ns-slideshow--show';  // set display: block !important
  const hide = 'ns-slideshow--hide';  // set display: none !important
  const showing = 'ns-slideshow--showing';  // animating to opacity -> 1
  const hiding = 'ns-slideshow--hiding';  // animating to opacity -> 0
  const START_SLIDESHOW_SELECTOR = '[data-start-slide-show="true"]';
  const END_SLIDESHOW_SELECTOR = '[data-slide-show-end="true"]';
  const AUTO_SCHEDULE_SELECTOR = `[${AUTO_SCHEDULE_ATTR}="true"]`;

  // Event Names
  const SLIDE_NEXT_EVENT = 'ns-slide-show-next';
  const SLIDE_END_EVENT = 'ns-slide-show-end';

  /**
   * Determines time taken to read a sentence on-screen, using the algorithm given below
   * timeToRead = 1300 + (wc * 130) ms
   * Source: https://psychology.stackexchange.com/a/1978
   * @param content {String} - Text to be shown on screen
   * @returns readTime {Number} - Optimal Screen Time in ms
   */
  function getOptimalScreenTime(content) {
    const ONBOARDING_TIME = 1.3e3; // Psychologists say, each screen needs an on-boarding time of 1.3s
    const sentence = content.trim();  // Get unadulterated sentence
    const wc = sentence.split(' ').length + 1;  // Word Count
    const readTime1Word = 0.13e3; //Each word (word + space) takes 2 * 65ms to read
    const readTime = ONBOARDING_TIME + (wc * readTime1Word);

    return readTime;
  }

  function getDirectChildren(root, selector) {
    return [].filter.call(root.children, el => el.matches(selector));
  }

  class NSSlideShow {
    /**
     * Slideshow start as soon as constructor is called
     * The next slide will be auto-scheduled if the current slide has
     * `auto-schedule` set to `true`
     * @param startEl {HTMLElement} - Element from which slideshow should start
     */
    constructor(startEl) {
      this.currentElement = startEl || document.querySelector(START_SLIDESHOW_SELECTOR);
      this.nextElement = null;
      this.stepIntoStack = [];
      this.participantList =[this.currentElement];

      this._scheduleIfRequired = this._scheduleIfRequired.bind(this);
      this._animateNext = this._animateNext.bind(this);
      this._switch = this._switch.bind(this);
      this._focus = this._focus.bind(this);
      this._stepInOut = this._stepInOut.bind(this);
      this._stepOut = this._stepOut.bind(this);
      this._stepInto = this._stepInto.bind(this);
      this._dispatchEvent = this._dispatchEvent.bind(this);
      this._removeSlideshowClasses = this._removeSlideshowClasses.bind(this);
      this.next = this.next.bind(this);
      this.cleanup = this.cleanup.bind(this);

      this._scheduleIfRequired();
      this._scheduledId = null;
    }

    _scheduleIfRequired() {
      if (this.currentElement.getAttribute(AUTO_SCHEDULE_ATTR) === 'true') {
        const screenTime = getOptimalScreenTime(this.currentElement.innerText);
        this._scheduledId = window.setTimeout(this.next, screenTime);
      }
    }

    _animateNext() {
      this.currentElement.removeEventListener('animationend', this._animateNext);
      this.currentElement.classList.remove(show);
      this.currentElement.classList.add(hide);
      window.requestAnimationFrame(() => {
        this.nextElement.classList.remove(hide);
        this.nextElement.classList.remove(hiding);
        this.nextElement.classList.add(show);
        this.nextElement.classList.add(showing);
        this._focus();
      });
    }

    _stepInOut() {
      if (this.stepIntoStack.length) {
        const stepInto = this.stepIntoStack.slice(-1)[0];
        const nextElList = stepInto.stepIntos;
        const nextEl = nextElList.shift();

        if (nextEl === undefined) {
          this._stepOut(stepInto);
          this._stepInOut();     // Support Nesting
        } else {
          this.nextElement = nextEl;
          if (this.currentElement === stepInto.root) {
            this.currentElement = this.currentElement.querySelector(stepInto.selector);
          }
        }
      } else {
        this.nextElement = this.currentElement.nextElementSibling;
      }
    }

    _stepOut(tree) {
      this.currentElement = tree.root;
      this.stepIntoStack.pop();
    }

    _switch() {
      this.nextElement.removeEventListener('animationend', this._switch);
      this.currentElement = this.nextElement;

      this._dispatchEvent(SLIDE_NEXT_EVENT);
      this._stepInOut();
      this._scheduleIfRequired();

      this.participantList.push(this.currentElement);
    }

    _focus() {
      const inputEl = this.nextElement.querySelector('input');
      const buttonEl = this.nextElement.querySelector('button');

      if (inputEl !== null) {
        inputEl.focus();
      } else if (buttonEl !== null) {
        buttonEl.focus();
      }
    }

    /**
     * Collects, All direct children to be transitioned - `stepIntos`
     * Hides all the `stepIntos` of a node (The root).
     * Pushes the root on top of the stack, so that the all stepInto elements are transitioned before
     * their parent's siblings are transitioned. (Important in cases where parent also has stepIntos)
     * @param stepIntoSelector {String} - CSS Selector representing stepIntos
     */
    _stepInto(stepIntoSelector) {
      const stepIntos = [].slice.call(getDirectChildren(this.nextElement, stepIntoSelector), 0);
      stepIntos.forEach((el, index) => {
        this.cleanup(el);
        if (index !== 0) {
          el.classList.add(hide);
        }
      });
      this.stepIntoStack.push({
        root: this.nextElement,
        selector: stepIntoSelector,
        stepIntos: stepIntos.slice(1)
      });
    }

    _dispatchEvent(eventName) {
      try {
        const event = new CustomEvent(eventName, {
          bubbles: true
        });
        this.currentElement.dispatchEvent(event);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        $(this.currentElement).trigger(eventName);
      }
    }

    _removeSlideshowClasses(element) {
      element.classList.remove(show);
      element.classList.remove(hide);
      element.classList.remove(showing);
      element.classList.remove(hiding);
    }

    cleanup(el) {
      if (el) {
        this._removeSlideshowClasses(el);
      } else {
        this.participantList.forEach(this._removeSlideshowClasses);
      }
    }

    next(seekToEl) {
      if (seekToEl && seekToEl instanceof HTMLElement) { // Ignore next slide and seek to slide specified by caller
        this.nextElement = seekToEl;
        if (this.stepIntoStack.length) {
          const stepInto = this.stepIntoStack.pop();
          this.currentElement = stepInto.root;
          this.stepIntoStack = [];
        }
      } else if (this.nextElement === null) {
        this.nextElement = this.currentElement.nextElementSibling;
      }

      const stepIntoSelector = this.nextElement.getAttribute(STEP_INTO_ATTR);

      if (stepIntoSelector !== null) {
        this._stepInto(stepIntoSelector);
      }

      if (this.currentElement.matches(AUTO_SCHEDULE_SELECTOR)) {
        window.clearTimeout(this._scheduledId);
      }

      this.currentElement.addEventListener('animationend', this._animateNext);
      this.currentElement.classList.remove(showing);
      this.currentElement.classList.add(hiding);

      if (this.nextElement === null || this.nextElement.matches(END_SLIDESHOW_SELECTOR)) {
        this._dispatchEvent(SLIDE_END_EVENT);
      }
      this.nextElement.addEventListener('animationend', this._switch);
    }

    previous() {
      const backTarget = this.currentElement.getAttribute(BACK_ATTR);
      this.nextElement = document.querySelector(backTarget) || this.currentElement.previousElementSibling;

      if (this.nextElement.matches(AUTO_SCHEDULE_SELECTOR)) {
        while (this.nextElement.matches(AUTO_SCHEDULE_SELECTOR)) {
          this.nextElement = this.nextElement.previousElementSibling;
        }
      }

      const stepIntoSelector = this.nextElement.getAttribute(STEP_INTO_ATTR);

      if (stepIntoSelector !== null) {
        this._stepInto(stepIntoSelector);
      }

      if (this.currentElement.matches(AUTO_SCHEDULE_SELECTOR)) {
        window.clearTimeout(this._scheduledId);
      }

      this.currentElement.addEventListener('animationend', this._animateNext);
      this.currentElement.classList.remove(showing);
      this.currentElement.classList.add(hiding);

      if (this.nextElement === null || this.nextElement.matches(END_SLIDESHOW_SELECTOR)) {
        this._dispatchEvent(SLIDE_END_EVENT);
      }
      this.nextElement.addEventListener('animationend', this._switch);
    }
  }

  window.NSSlideShow = NSSlideShow;
})();
