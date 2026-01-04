import React from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideProps } from 'lucide-react';

interface LucideIconProps {
    name: string;
    className?: string;
    size?: number;
}

// Type for the icons object - each icon is a React component that accepts LucideProps
type IconComponent = React.FC<LucideProps>;
type IconsType = Record<string, IconComponent>;

export const LucideIcon: React.FC<LucideIconProps> = ({ name, className, size = 20 }) => {
    // Get the icon component from lucide-react
    const IconComponent = (LucideIcons as unknown as IconsType)[name];

    if (!IconComponent) {
        console.warn(`Lucide icon "${name}" not found`);
        return null;
    }

    return <IconComponent className={className} size={size} />;
};

// Helper to check if a string is a Lucide icon reference
export const isLucideIcon = (icon: string | undefined): boolean => {
    return icon?.startsWith('lucide:') ?? false;
};

// Helper to extract icon name from "lucide:IconName" format
export const getLucideIconName = (icon: string): string => {
    return icon.replace('lucide:', '');
};

export default LucideIcon;
