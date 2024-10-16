import { useSidebarModalStore } from "@/stores/ui/sidebarModalStore";
import { ReactNode } from "react";

export default function SidebarModal() {
    const { isSidebarModalOpen, content } = useSidebarModalStore();
    return (
        <div
            className={`absolute left-0 top-0 z-40 h-full min-h-0 max-w-[35rem] overflow-scroll rounded-6 border border-stroke bg-modal p-12 shadow-fg-1 backdrop-blur-32 ${
                isSidebarModalOpen ? "flex animate-scale-in" : "hidden"
            }`}
        >
            {content}
        </div>
    );
}

export function SidebarModalLauncher({
    buttonLabel,
    contents,
}: {
    buttonLabel: string;
    contents: ReactNode;
}) {
    const { toggleOpen, setContent, isSidebarModalOpen } =
        useSidebarModalStore();
    return (
        <button
            onClick={() => {
                if (!isSidebarModalOpen) {
                    setContent(contents);
                    toggleOpen();
                } else {
                    setContent(contents);
                }
            }}
            className="outline-none duration-150 ease-out hover:text-accent focus-visible:-translate-y-4 disabled:pointer-events-none disabled:opacity-50"
        >
            {buttonLabel}
        </button>
    );
}
