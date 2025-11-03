import React, { useState, useEffect } from 'react';

// This is a self-contained modal component.
export default function AvailabilityModal({
    isOpen,
    onClose,
    onSave,
    dayName,
    period,
    allUsers,
    initialSelectedIds
}) {
    // Use a Set for efficient add/remove/check operations
    const [selectedIds, setSelectedIds] = useState(new Set(initialSelectedIds));

    // Update state if the initial IDs change (e.g., opening a new modal)
    useEffect(() => {
        setSelectedIds(new Set(initialSelectedIds));
    }, [initialSelectedIds]);

    const handleToggleUser = (userId) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(userId)) {
            newSet.delete(userId);
        } else {
            newSet.add(userId);
        }
        setSelectedIds(newSet);
    };

    const handleSelectAll = (isChecked) => {
        if (isChecked) {
            const allIds = allUsers.map(u => u.user_id);
            setSelectedIds(new Set(allIds));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSave = () => {
        // Convert the Set back to an array for the API call
        onSave(Array.from(selectedIds));
    };

    const isAllSelected = allUsers.length > 0 && selectedIds.size === allUsers.length;

    if (!isOpen) {
        return null;
    }

    return (
        // Modal Overlay
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center"
            onClick={onClose} 
        >
            {/* Modal Content */}
            <div 
                className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 relative" 
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content
            >
                <h3 className="text-xl font-bold text-gray-800">
                    {dayName} - {period}
                </h3>
                <p className="text-sm text-gray-500 mb-4">Select available members.</p>

                {/* --- User List --- */}
                <div className="border rounded-md max-h-64 overflow-y-auto">
                    <ul className="divide-y divide-gray-200">
                        {/* "Select All" Checkbox */}
                        <li className="p-3 bg-gray-50 sticky top-0 z-10">
                            <label className="flex items-center w-full">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    checked={isAllSelected}
                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                />
                                <span className="ml-3 font-semibold text-sm text-gray-700">
                                    Select All ({selectedIds.size} / {allUsers.length})
                                </span>
                            </label>
                        </li>

                        {/* User Checkboxes */}
                        {allUsers.map(user => (
                            <li key={user.user_id} className="p-3 hover:bg-gray-50">
                                <label className="flex items-center w-full">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={selectedIds.has(user.user_id)}
                                        onChange={() => handleToggleUser(user.user_id)}
                                    />
                                    <span className="ml-3 text-sm text-gray-800">{user.name}</span>
                                </label>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* --- Action Buttons --- */}
                <div className="flex justify-end space-x-3 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="py-2 px-4 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="py-2 px-4 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}

