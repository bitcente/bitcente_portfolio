import { isMobile, isTouchPrimary } from "./Screen"

// Phones and tablets get a lighter copy of every video (720p H.264, the .mobile.mp4 next to it): the originals are
// 1080p and mostly VP9, which iPhones decode slowly and with a lot of memory, and a few at once freeze the page
export function videoSrc(src: string) {
    if (!isMobile() && !isTouchPrimary()) return src
    return src.replace(/\.(mp4|webm)$/, ".mobile.mp4")
}
