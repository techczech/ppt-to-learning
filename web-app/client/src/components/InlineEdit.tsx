import React, { useState, useRef, useEffect } from 'react';
import { Check, X, Pencil, Plus } from 'lucide-react';
import clsx from 'clsx';
import type { Tag } from '../api';

// --- InlineText ---
interface InlineTextProps {
    value: string;
    placeholder?: string;
    onSave: (value: string) => Promise<void>;
    multiline?: boolean;
    className?: string;
}

export const InlineText: React.FC<InlineTextProps> = ({
    value,
    placeholder = 'Click to edit...',
    onSave,
    multiline = false,
    className = ''
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    useEffect(() => {
        setEditValue(value);
    }, [value]);

    const handleSave = async () => {
        if (editValue !== value) {
            setIsSaving(true);
            try {
                await onSave(editValue);
            } catch (e) {
                setEditValue(value);
            } finally {
                setIsSaving(false);
            }
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditValue(value);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) {
            e.preventDefault();
            handleSave();
        }
        if (e.key === 'Escape') {
            handleCancel();
        }
    };

    if (isEditing) {
        const InputComponent = multiline ? 'textarea' : 'input';
        return (
            <div className={clsx("flex items-start gap-1", className)}>
                <InputComponent
                    ref={inputRef as any}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSave}
                    disabled={isSaving}
                    className={clsx(
                        "flex-1 px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm",
                        multiline && "min-h-[60px] resize-none"
                    )}
                    rows={multiline ? 3 : undefined}
                />
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="p-1 text-green-600 hover:bg-green-50 rounded flex-shrink-0"
                >
                    <Check className="w-4 h-4" />
                </button>
                <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="p-1 text-gray-400 hover:bg-gray-100 rounded flex-shrink-0"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            className={clsx(
                "group flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-gray-100 transition-colors",
                className
            )}
        >
            <span className={clsx("flex-1 text-sm", !value && "text-gray-400 italic")}>
                {value || placeholder}
            </span>
            <Pencil className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>
    );
};

// --- InlineDropdown ---
interface DropdownOption<T> {
    value: T;
    label: string;
    color?: string;
}

interface InlineDropdownProps<T extends string | null> {
    value: T;
    options: DropdownOption<T>[];
    placeholder?: string;
    onSave: (value: T) => Promise<void>;
    allowNull?: boolean;
    nullLabel?: string;
    className?: string;
}

export function InlineDropdown<T extends string | null>({
    value,
    options,
    placeholder = 'Select...',
    onSave,
    allowNull = false,
    nullLabel = 'None',
    className = ''
}: InlineDropdownProps<T>) {
    const [isSaving, setIsSaving] = useState(false);

    const handleChange = async (newValue: string) => {
        const actualValue = (newValue === '' ? null : newValue) as T;
        if (actualValue !== value) {
            setIsSaving(true);
            try {
                await onSave(actualValue);
            } finally {
                setIsSaving(false);
            }
        }
    };

    const currentOption = options.find(o => o.value === value);

    return (
        <div className={clsx("flex items-center gap-2", className)}>
            {currentOption?.color && (
                <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: currentOption.color }}
                />
            )}
            <select
                value={value ?? ''}
                onChange={(e) => handleChange(e.target.value)}
                disabled={isSaving}
                className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
            >
                {allowNull && <option value="">{nullLabel}</option>}
                {!allowNull && !value && <option value="" disabled>{placeholder}</option>}
                {options.map(opt => (
                    <option key={opt.value ?? 'null'} value={opt.value ?? ''}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

// --- InlineTagEditor ---
interface InlineTagEditorProps {
    selectedTagIds: string[];
    availableTags: Tag[];
    onSave: (tagIds: string[]) => Promise<void>;
    className?: string;
}

export const InlineTagEditor: React.FC<InlineTagEditorProps> = ({
    selectedTagIds,
    availableTags,
    onSave,
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggleTag = async (tagId: string) => {
        const newTagIds = selectedTagIds.includes(tagId)
            ? selectedTagIds.filter(id => id !== tagId)
            : [...selectedTagIds, tagId];

        setIsSaving(true);
        try {
            await onSave(newTagIds);
        } finally {
            setIsSaving(false);
        }
    };

    const selectedTags = availableTags.filter(t => selectedTagIds.includes(t.id));

    return (
        <div className={clsx("relative", className)} ref={dropdownRef}>
            <div
                onClick={() => !isSaving && setIsOpen(!isOpen)}
                className={clsx(
                    "flex flex-wrap items-center gap-1 min-h-[32px] px-2 py-1 border border-gray-200 rounded cursor-pointer hover:border-gray-300 transition-colors",
                    isSaving && "opacity-50"
                )}
            >
                {selectedTags.length === 0 ? (
                    <span className="text-sm text-gray-400 italic">No tags</span>
                ) : (
                    selectedTags.map(tag => (
                        <span
                            key={tag.id}
                            className="inline-flex items-center px-2 py-0.5 text-xs rounded-full"
                            style={{
                                backgroundColor: `${tag.color}20`,
                                color: tag.color
                            }}
                        >
                            {tag.name}
                        </span>
                    ))
                )}
                <Plus className="w-3 h-3 text-gray-400 ml-auto flex-shrink-0" />
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {availableTags.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-400">No tags available</div>
                    ) : (
                        availableTags.map(tag => (
                            <label
                                key={tag.id}
                                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedTagIds.includes(tag.id)}
                                    onChange={() => handleToggleTag(tag.id)}
                                    className="w-4 h-4 rounded border-gray-300"
                                    style={{ accentColor: tag.color }}
                                />
                                <span
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: tag.color }}
                                />
                                <span className="text-sm">{tag.name}</span>
                            </label>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default { InlineText, InlineDropdown, InlineTagEditor };
