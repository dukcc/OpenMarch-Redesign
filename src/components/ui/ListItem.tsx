import React from "react";
import clsx from "clsx";

export type ListItemProps = {
    children: React.ReactNode;
    selected?: boolean;
    className?: string;
};

export const ListItem = ({
    children,
    selected = false,
    className,
}: ListItemProps) => {
    return (
        <div
            className={clsx(
                `flex w-full items-center justify-between gap-x-10 ${selected && "rounded-6 border border-stroke bg-fg-2"} h-[2.5rem] px-22 text-text`,
                className,
            )}
        >
            {children}
        </div>
    );
};
