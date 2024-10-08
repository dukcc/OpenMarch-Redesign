export default function ToolbarSection({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-[2.55rem] w-fit items-center gap-20 rounded-6 border border-stroke bg-fg-1 px-16">
            {children}
        </div>
    );
}
