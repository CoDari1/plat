export default function TopBar() {
    return (
        <header className="topbar">
            <div className="brand">
                <span className="brand-title">PLAT/STITCH</span>
                <span className="brand-subtitle">manual control-point alignment</span>
            </div>
            <div className="workflow" aria-label="Workflow">
                <span>01 LAYOUT</span><span>02 POINTS</span><span>03 ALIGN</span><span>04 EXPORT</span>
            </div>
        </header>
    );
}
