export function isTouchDevice() {
    return (('ontouchstart' in window) ||
       (navigator.maxTouchPoints > 0));
}

// phones and tablets: the main way to use the page is a finger (unlike a laptop that also has a touch screen)
export function isTouchPrimary() {
    return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

export function isMobile() {
    return isTouchDevice() && window.innerWidth < 1024;
}