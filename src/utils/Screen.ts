export function isTouchDevice() {
    return (('ontouchstart' in window) ||
       (navigator.maxTouchPoints > 0));
}

export function isMobile() {
    return isTouchDevice() && window.innerWidth < 1024;
}