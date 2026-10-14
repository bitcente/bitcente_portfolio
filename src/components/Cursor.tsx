import gsap from "gsap/all";
import { useEffect, useRef } from "react";
import { useBitcenteStore } from "../store";
import { isTouchDevice } from "../utils/Screen";

export default function Cursor() {
    if (isTouchDevice()) return;
    
    const cursorPointer = useBitcenteStore((state) => state.cursorPointer)

    const cursorRef = useRef(null);
    const initiated = useRef(false);

    gsap.set(cursorRef.current, {xPercent: -35, yPercent: -8});

    useEffect(() => {
        let xTo = gsap.quickTo(cursorRef.current, "x", {duration: 0.0001, ease: "power3"}),
        yTo = gsap.quickTo(cursorRef.current, "y", {duration: 0.0001, ease: "power3"})

        let timeout: number;

        document.body.addEventListener('pointermove', (e) => {
            xTo(e.clientX)
            yTo(e.clientY)

            if (!initiated.current) {
                document.body.classList.add('cursor-moved')
                initiated.current = true
            }

            document.body.classList.remove('cursor-out')

            if (document.body.classList.contains('mouse-stopped')) {
                document.body.classList.remove('mouse-stopped')
            }

            clearTimeout(timeout);
            timeout = setTimeout(function(){
                if (document.body.classList.contains('player')) {
                    document.body.classList.add('mouse-stopped')
                }
            }, 2500);
        })

        // hidden while the real cursor is out of the window
        document.documentElement.addEventListener('pointerleave', () => {
            document.body.classList.add('cursor-out')
        })
    }, [])
    

        
    return <div id="cursor" ref={cursorRef}>
        {!cursorPointer && <img src={`${import.meta.env.BASE_URL}img/cursor/cursor_arrow.png`} alt="Arrow Cursor" />}
        {cursorPointer && <img src={`${import.meta.env.BASE_URL}img/cursor/cursor_pointer.png`} alt="Pointer Cursor" />}
    </div>
}