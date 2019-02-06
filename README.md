# SlideshowJS
  
   ```
   A utility to create slideshows out of any sequence of HTML elements
   It works by using javascript to transition each element smoothly (60fps) from display: none to display: block
  
   To setup slideshow on your HTML, the following config needs to be set on the DOM elements
  
   Assumptions:
  
   Given a root element, the slideshow will include *all* siblings in slideshow until it encounters, data-slide-end='true'
  
   HTML Config:
  
   `data-ns-slide=true` - Indicates that the element is a participant in slideshow, note that
                        all of the elements with this attribute will have their display CSS property set to none;
                        It can cause some unintended side-effect, for example if used in conjunction with
                        `data-start-slide-show`
   `data-auto-schedule=true`  - Signifies that the HTML element will appear on screen for some time and automatically
                             transition to next sibling.
   `data-step-into=CSSSelector`  - Signifies that the element's children (that qualify the CSS Selector specified)
                                  will be shown one at a time before moving on to next element. (Can be nested)
   `data-slide-end=true`  - Signifies end of slideshow
   `data-start-slide-show=true`  - This element will be considered the starting element of slideshow if no argument is passed to
                                 QPSlideshow constructor.
  
   Events:
  
   Emits the following custom events to indicate status of the slideshow
  
   `ns-slide-show-next` - When a transition from one slide to another is complete
   `ns-slide-show-end` - When slideshow ends
   ```
