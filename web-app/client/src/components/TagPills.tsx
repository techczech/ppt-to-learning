import React, { useState } from 'react';
import { X, Plus, Tag as TagIcon } from 'lucide-react';
import clsx from 'clsx';
import type { Tag } from '../api';

interface TagPillProps {
    tag: Tag;
    selected?: boolean;
    onSelect?: () => void;
    onRemove?: () => void;
    size?: 'sm' | 'md';
}

export const TagPill: React.FC<TagPillProps> = ({
    tag,
    selected = false,
    onSelect,
    onRemove,
    size = 'md'
}) => {
    return (
        <span
            onClick={onSelect}
            className={clsx(
                "inline-flex items-center rounded-full font-medium transition-all",
                size === 'sm' ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
                onSelect && "cursor-pointer",
                selected
                    ? "ring-2 ring-offset-1"
                    : "opacity-80 hover:opacity-100"
            )}
            style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
                ...(selected && { ringColor: tag.color })
            }}
        >
            {tag.name}
            {onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="ml-1 hover:bg-white/30 rounded-full p-0.5"
                >
                    <X className="w-3 h-3" />
                </button>
            )}
        </span>
    );
};

interface TagFilterProps {
    tags: Tag[];
    selectedTagIds: string[];
    onToggleTag: (tagId: string) => void;
    onClearAll: () => void;
}

export const TagFilter: React.FC<TagFilterProps> = ({
    tags,
    selectedTagIds,
    onToggleTag,
    onClearAll
}) => {
    if (tags.length === 0) return null;

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <TagIcon className="w-4 h-4 text-gray-400" />
            {tags.map(tag => (
                <TagPill
                    key={tag.id}
                    tag={tag}
                    selected={selectedTagIds.includes(tag.id)}
                    onSelect={() => onToggleTag(tag.id)}
                    size="sm"
                />
            ))}
            {selectedTagIds.length > 0 && (
                <button
                    onClick={onClearAll}
                    className="text-xs text-gray-500 hover:text-gray-700 ml-2"
                >
                    Clear filters
                </button>
            )}
        </div>
    );
};

interface TagSelectorProps {
    tags: Tag[];
    selectedTagIds: string[];
    onToggleTag: (tagId: string) => void;
    onCreateTag: (name: string) => void;
}

export const TagSelector: React.FC<TagSelectorProps> = ({
    tags,
    selectedTagIds,
    onToggleTag,
    onCreateTag
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newTagName, setNewTagName] = useState('');

    const handleAddTag = () => {
        if (newTagName.trim()) {
            onCreateTag(newTagName.trim());
            setNewTagName('');
            setIsAdding(false);
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
                {tags.map(tag => (
                    <TagPill
                        key={tag.id}
                        tag={tag}
                        selected={selectedTagIds.includes(tag.id)}
                        onSelect={() => onToggleTag(tag.id)}
                        size="sm"
                    />
                ))}
                {!isAdding ? (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="inline-flex items-center px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all"
                    >
                        <Plus className="w-3 h-3 mr-1" />
                        Add tag
                    </button>
                ) : (
                    <div className="inline-flex items-center gap-1">
                        <input
                            type="text"
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddTag();
                                if (e.key === 'Escape') {
                                    setIsAdding(false);
                                    setNewTagName('');
                                }
                            }}
                            placeholder="Tag name"
                            className="w-24 px-2 py-0.5 text-xs border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                        <button
                            onClick={handleAddTag}
                            className="p-1 text-green-600 hover:bg-green-50 rounded-full"
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                        <button
                            onClick={() => {
                                setIsAdding(false);
                                setNewTagName('');
                            }}
                            className="p-1 text-gray-400 hover:bg-gray-100 rounded-full"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

interface TagListDisplayProps {
    tags: Tag[];
    tagIds: string[];
    size?: 'sm' | 'md';
}

export const TagListDisplay: React.FC<TagListDisplayProps> = ({
    tags,
    tagIds,
    size = 'sm'
}) => {
    const displayTags = tags.filter(t => tagIds.includes(t.id));
    if (displayTags.length === 0) return null;

    return (
        <div className="flex items-center gap-1 flex-wrap">
            {displayTags.map(tag => (
                <TagPill key={tag.id} tag={tag} size={size} />
            ))}
        </div>
    );
};
