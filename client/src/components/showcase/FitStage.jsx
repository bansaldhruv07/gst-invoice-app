// Draws a fixed-size scene and scales it to whatever room is available,
// so nothing is ever cut off on short or narrow screens.
import { useState, useRef, useLayoutEffect } from "react";

export default function FitStage({ width = 460, height = 400, max = 1.2, children }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const node = ref.current;
    const fit = () => setScale(Math.min(max, node.clientWidth / width, node.clientHeight / height));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, [width, height, max]);

  return (
    <div ref={ref} className="relative w-full h-full">
      <div className="absolute left-1/2 top-1/2" style={{ width, height, transform: `translate(-50%, -50%) scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
