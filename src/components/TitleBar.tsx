import { Minus, Square, X } from "@phosphor-icons/react";

export default function TitleBar() {
    const isMacOS = true;

    function WindowsControls() {
        return;
    }
    function MacControls() {
        return (
            <div id="mac-icons" className="window-control-btn flex gap-8">
                <button
                    className="size-12 rounded-full bg-red duration-150 ease-out hover:opacity-75"
                    onClick={() => {
                        window.electron.closeWindow();
                    }}
                />
                <button
                    className="size-12 rounded-full bg-yellow duration-150 ease-out hover:opacity-75"
                    onClick={() => {
                        window.electron.minimizeWindow();
                    }}
                />
                <button
                    className="size-12 rounded-full bg-green duration-150 ease-out hover:opacity-75"
                    onClick={() => {
                        window.electron.fullscreenWindow();
                    }}
                />
            </div>
        );
    }
    return (
        <div className="main-app-titlebar flex h-fit w-full items-center justify-between text-text">
            <div className="flex items-center gap-12 px-24 py-8">
                {isMacOS && <MacControls />}
                <p className="text-body leading-none">OpenMarch</p>
                <p className="text-body leading-none opacity-50">0.0.2</p>
            </div>
            <div id="windows-icons" className="flex">
                <button
                    className="window-control-btn cursor-pointer px-16 py-8 duration-150 ease-out hover:text-accent"
                    onClick={() => {
                        window.electron.minimizeWindow();
                    }}
                >
                    <Minus size={20} />
                </button>
                <button
                    className="window-control-btn cursor-pointer px-16 py-8 duration-150 ease-out hover:text-accent"
                    onClick={() => {
                        window.electron.maximizeWindow();
                    }}
                >
                    <Square size={20} />
                </button>
                <button
                    className="window-control-btn cursor-pointer px-16 py-8 pr-24 duration-150 ease-out hover:text-red"
                    onClick={() => {
                        window.electron.closeWindow();
                    }}
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    );
}
