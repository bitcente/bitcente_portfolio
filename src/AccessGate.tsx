import { useEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText);

const PARAM = "key";
const SECRET = "portfolio";
const STORAGE_KEY = "access";

function hasAccess(): boolean {
  const fromUrl = new URLSearchParams(window.location.search).get(PARAM);

  if (fromUrl === SECRET) {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* storage unavailable */
    }
    return true;
  }

  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function AccessDenied() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const splits: SplitText[] = [];

    const ctx = gsap.context(() => {
      const message = new SplitText(".access-denied__message", { type: "words,chars" });
      const contact = new SplitText(".access-denied__contact", { type: "words,chars" });
      splits.push(message, contact);

      // hide everything before revealing the container to avoid a flash
      gsap.set([message.chars, contact.chars], { autoAlpha: 0 });
      gsap.set(container.current, { visibility: "visible" });

      gsap
        .timeline({ defaults: { ease: "none" } })
        .to(message.chars, { autoAlpha: 1, duration: 0.01, stagger: 0.06 })
        .to(
          contact.chars,
          { autoAlpha: 1, duration: 0.01, stagger: 0.045 },
          "+=0.3"
        );
    }, container);

    return () => {
      ctx.revert();
      splits.forEach((s) => s.revert());
    };
  }, []);

  return (
    <div className="access-denied" ref={container}>
      <p className="access-denied__message">Access denied</p>
      <p className="access-denied__contact">
        You can contact me at{" "}
        <a className="access-denied__link" href="mailto:hi@bitcente.com">
          hi@bitcente.com
        </a>{" "}
        to get access<span className="blink">_</span>
      </p>
    </div>
  );
}

interface AccessGateProps {
  children: ReactNode;
}

export default function AccessGate({ children }: AccessGateProps) {
  const [allowed] = useState<boolean>(hasAccess);

  if (!allowed) return <AccessDenied />;
  return <>{children}</>;
}