import { useEffect, useMemo, useRef, useState } from 'react';

const initialMembers = [
    { id: 'm1', name: 'Alex', emoji: '🦊', active: true, role: 'owner', userId: 'u1' },
    { id: 'm2', name: 'Jamie', emoji: '🐼', active: true, role: 'admin' },
    { id: 'm3', name: 'Kai', emoji: '🐨', active: true, role: 'member' },
];

const accountUser = {
    id: 'u1',
    name: 'Alex',
};

const initialWorkspace = {
    id: 'w1',
    name: 'HomeJoy Space',
};

const initialChores = [
    { id: 'c1', title: 'Water plants', weight: 3, done: false, assigneeId: 'm1', doneAt: null, date: dateKeyLocal(new Date()), recurrence: 'none' },
    { id: 'c2', title: 'Fold laundry', weight: 4, done: false, assigneeId: 'm2', doneAt: null, date: dateKeyLocal(new Date()), recurrence: 'weekly' },
    { id: 'c3', title: 'Clean table', weight: 2, done: false, assigneeId: 'm3', doneAt: null, date: dateKeyLocal(new Date()), recurrence: 'daily' },
    { id: 'c4', title: 'Take out trash', weight: 5, done: false, assigneeId: 'm1', doneAt: null, date: dateKeyLocal(new Date()), recurrence: 'none' },
];

const HELP_CREDIT_WEEKLY_LIMIT = 3;
const HELP_CREDIT_SPEND = 1;
const HELP_CREDIT_EARN = 0.5;
const COMPLETION_UNDO_WINDOW_MS = 3000;

function round(value) {
    return Math.round(value);
}

function dateKeyLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isSameMonth(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function homeClimateFrom(chores, slideProgressById = {}, pendingCompletionById = {}) {
    const totalWeight = chores.reduce((sum, item) => sum + item.weight, 0);
    const completionRatioById = Object.fromEntries(
        chores.map((item) => {
            if (item.done || pendingCompletionById[item.id]) return [item.id, 1];
            const progress = Number(slideProgressById[item.id]);
            const normalized = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) / 100 : 0;
            return [item.id, normalized];
        }),
    );

    const completedWeight = chores.reduce((sum, item) => sum + item.weight * (completionRatioById[item.id] || 0), 0);
    const pendingWeight = Math.max(0, totalWeight - completedWeight);
    const completedCount = chores.reduce((sum, item) => sum + (completionRatioById[item.id] || 0), 0);
    const pendingCount = Math.max(0, chores.length - completedCount);

    const harmonyScore = totalWeight === 0 ? 100 : round((completedWeight / totalWeight) * 100);
    const cleanlinessScore = harmonyScore;
    const dirtinessScore = 100 - harmonyScore;
    const clutterFeelsLike = Math.min(100, round(dirtinessScore * 0.7 + pendingCount * 10));
    const recoveryPotential = Math.max(0, 100 - clutterFeelsLike);

    return {
        totalWeight,
        pendingWeight,
        completedWeight,
        completedCount,
        pendingCount,
        harmonyScore,
        cleanlinessScore,
        dirtinessScore,
        clutterFeelsLike,
        recoveryPotential,
    };
}

function monthDailyStats(chores, monthDate) {
    const totalWeight = chores.reduce((sum, item) => sum + item.weight, 0);
    const totalCount = chores.length;
    const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    const stats = {};
    for (let day = 1; day <= end.getDate(); day += 1) {
        const current = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
        const key = dateKeyLocal(current);
        const doneToday = chores.filter((item) => item.doneAt && isSameDay(new Date(item.doneAt), current));
        const completedWeight = doneToday.reduce((sum, item) => sum + item.weight, 0);
        const completedCount = doneToday.length;
        const pendingCount = Math.max(0, totalCount - completedCount);
        const harmonyScore = totalWeight === 0 ? 100 : round((completedWeight / totalWeight) * 100);
        const cleanlinessScore = harmonyScore;
        const dirtinessScore = 100 - harmonyScore;
        const clutterFeelsLike = Math.min(100, round(dirtinessScore * 0.7 + pendingCount * 10));
        const recoveryPotential = Math.max(0, 100 - clutterFeelsLike);

        stats[key] = {
            key,
            date: current,
            completedWeight,
            completedCount,
            pendingCount,
            harmonyScore,
            cleanlinessScore,
            dirtinessScore,
            clutterFeelsLike,
            recoveryPotential,
            weather: weatherFromDirtiness(dirtinessScore),
            totalWeight,
        };
    }

    return stats;
}

function weatherFromDirtiness(dirtinessScore) {
    if (dirtinessScore <= 20) return 'sunny';
    if (dirtinessScore <= 45) return 'cloudy';
    if (dirtinessScore <= 70) return 'overcast';
    return 'rainy';
}

function weatherIconFrom(weather) {
    if (weather === 'sunny') return '☀️';
    if (weather === 'cloudy') return '⛅';
    if (weather === 'overcast') return '☁️';
    return '🌧️';
}

function recurrenceLabel(recurrence) {
    if (recurrence === 'daily') return '每日';
    if (recurrence === 'weekly') return '每週';
    if (recurrence === 'monthly') return '每月';
    return '單次';
}

function weightTone(weight) {
    if (weight >= 5) return 'critical';
    if (weight >= 4) return 'high';
    if (weight >= 3) return 'medium';
    if (weight >= 2) return 'low';
    return 'light';
}

function roleLabel(role) {
    if (role === 'owner') return 'Owner';
    if (role === 'admin') return 'Admin';
    return 'Member';
}

function resolveCurrentUserId(members, accountUserId) {
    const linked = members.find((member) => member.userId === accountUserId && member.active);
    if (linked) return linked.id;

    const owner = members.find((member) => member.role === 'owner' && member.active);
    if (owner) return owner.id;

    const firstActive = members.find((member) => member.active);
    if (firstActive) return firstActive.id;

    return members[0]?.id || null;
}

function isTaskScheduledForDate(task, targetDate) {
    const taskDate = new Date(`${task.date}T00:00:00`);
    const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

    if (task.recurrence === 'none') return isSameDay(taskDate, target);
    if (task.recurrence === 'daily') return taskDate <= target;
    if (task.recurrence === 'weekly') return taskDate <= target && taskDate.getDay() === target.getDay();
    if (task.recurrence === 'monthly') return taskDate <= target && taskDate.getDate() === target.getDate();
    return false;
}

function pushEvent(eventList, type, payload = {}) {
    const entry = {
        type,
        payload,
        at: new Date().toISOString(),
    };
    return [entry, ...eventList].slice(0, 40);
}

function mondayWeekKeyFrom(date) {
    const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const weekday = current.getDay();
    const offset = weekday === 0 ? -6 : 1 - weekday;
    current.setDate(current.getDate() + offset);
    return dateKeyLocal(current);
}

function roundCreditToHalf(value) {
    return Math.round(value * 2) / 2;
}

function formatCredit(credit) {
    if (!Number.isFinite(credit)) return '0';
    return Number.isInteger(credit) ? `${credit}` : credit.toFixed(1);
}

function createInitialHelpCredits(memberList) {
    return memberList.reduce((accumulator, member) => {
        accumulator[member.id] = HELP_CREDIT_WEEKLY_LIMIT;
        return accumulator;
    }, {});
}

function isSameCreditBook(a, b) {
    const aKeys = Object.keys(a || {});
    const bKeys = Object.keys(b || {});
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => (a[key] ?? 0) === (b[key] ?? 0));
}

function ensureHelpCreditsForWeek(memberList, creditBook, weekKey) {
    const currentWeekKey = mondayWeekKeyFrom(new Date());
    const shouldReset = weekKey !== currentWeekKey;
    const nextCredits = memberList.reduce((accumulator, member) => {
        if (shouldReset) {
            accumulator[member.id] = HELP_CREDIT_WEEKLY_LIMIT;
            return accumulator;
        }

        const current = Number(creditBook?.[member.id]);
        const normalized = Number.isFinite(current)
            ? Math.min(HELP_CREDIT_WEEKLY_LIMIT, Math.max(0, roundCreditToHalf(current)))
            : HELP_CREDIT_WEEKLY_LIMIT;
        accumulator[member.id] = normalized;
        return accumulator;
    }, {});

    return {
        credits: nextCredits,
        weekKey: currentWeekKey,
        didReset: shouldReset,
    };
}

export default function App() {
    const initialCurrentUserId = useMemo(() => resolveCurrentUserId(initialMembers, accountUser.id), []);
    const initialWeekKey = useMemo(() => mondayWeekKeyFrom(new Date()), []);
    const initialHelpCredits = useMemo(() => createInitialHelpCredits(initialMembers), []);
    const [workspace, setWorkspace] = useState(initialWorkspace);
    const [members, setMembers] = useState(initialMembers);
    const [chores, setChores] = useState(initialChores);
    const [currentUserId, setCurrentUserId] = useState(initialCurrentUserId);
    const [spaces, setSpaces] = useState(() => ([{
        id: initialWorkspace.id,
        name: initialWorkspace.name,
        members: initialMembers,
        chores: initialChores,
        events: [],
        currentUserId: resolveCurrentUserId(initialMembers, accountUser.id),
        helpCredits: initialHelpCredits,
        helpCreditsWeekKey: initialWeekKey,
        lastUsedAt: new Date().toISOString(),
    }]));
    const [helpCredits, setHelpCredits] = useState(initialHelpCredits);
    const [helpCreditsWeekKey, setHelpCreditsWeekKey] = useState(initialWeekKey);
    const [managementOpen, setManagementOpen] = useState(false);
    const [managementTab, setManagementTab] = useState('space');
    const [createSpaceOpen, setCreateSpaceOpen] = useState(false);
    const [swapOpen, setSwapOpen] = useState(false);
    const [quickAddOpen, setQuickAddOpen] = useState(false);
    const [listEditMode, setListEditMode] = useState(false);
    const [swapSubmitting, setSwapSubmitting] = useState(false);
    const [swapStatus, setSwapStatus] = useState('');
    const [selectedChoreId, setSelectedChoreId] = useState(null);
    const [newTitle, setNewTitle] = useState('');
    const [newWeight, setNewWeight] = useState(3);
    const [newAssignee, setNewAssignee] = useState(() => initialMembers[0].id);
    const [newDate, setNewDate] = useState(() => dateKeyLocal(new Date()));
    const [newRecurrence, setNewRecurrence] = useState('none');
    const [formError, setFormError] = useState('');
    const [memberError, setMemberError] = useState('');
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberEmoji, setNewMemberEmoji] = useState('🙂');
    const [newSpaceName, setNewSpaceName] = useState('');
    const [newOwnerEmoji, setNewOwnerEmoji] = useState('🙂');
    const [spaceError, setSpaceError] = useState('');
    const [editError, setEditError] = useState('');
    const [events, setEvents] = useState([]);
    const [successToast, setSuccessToast] = useState('');
    const [highlightedChoreId, setHighlightedChoreId] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [selectedDayKey, setSelectedDayKey] = useState(null);
    const [calendarCollapsed, setCalendarCollapsed] = useState(true);
    const [editingChoreId, setEditingChoreId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editWeight, setEditWeight] = useState(3);
    const [editAssignee, setEditAssignee] = useState(() => initialMembers[0].id);
    const [editDate, setEditDate] = useState(() => dateKeyLocal(new Date()));
    const [editRecurrence, setEditRecurrence] = useState('none');
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [completionSlideById, setCompletionSlideById] = useState({});
    const [completionUndoById, setCompletionUndoById] = useState({});
    const [completionCountdownNow, setCompletionCountdownNow] = useState(Date.now());
    const weatherRef = useRef('sunny');
    const acceptTimerRef = useRef(null);
    const clearHighlightTimerRef = useRef(null);
    const clearToastTimerRef = useRef(null);
    const completionUndoTimersRef = useRef({});
    const newTitleInputRef = useRef(null);

    const activeMembers = useMemo(() => members.filter((member) => member.active), [members]);
    const memberById = useMemo(
        () => Object.fromEntries(members.map((member) => [member.id, member])),
        [members],
    );
    const currentUser = memberById[currentUserId] || null;
    const canManageMembers = currentUser?.role === 'owner' || currentUser?.role === 'admin';

    const climate = useMemo(
        () => homeClimateFrom(chores, completionSlideById, completionUndoById),
        [chores, completionSlideById, completionUndoById],
    );
    const weather = useMemo(() => weatherFromDirtiness(climate.dirtinessScore), [climate.dirtinessScore]);
    const weatherIcon = useMemo(() => weatherIconFrom(weather), [weather]);
    const activeDate = useMemo(
        () => (selectedDayKey ? new Date(`${selectedDayKey}T00:00:00`) : new Date()),
        [selectedDayKey],
    );
    const managedChores = useMemo(
        () => [...chores].sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1;
            if (a.weight !== b.weight) return b.weight - a.weight;
            return a.title.localeCompare(b.title);
        }),
        [chores],
    );
    const visibleChores = useMemo(
        () => managedChores.filter((item) => isTaskScheduledForDate(item, activeDate)),
        [managedChores, activeDate],
    );
    const pending = useMemo(() => visibleChores.filter((item) => !item.done), [visibleChores]);
    const memberTaskCounts = useMemo(
        () => members.reduce((accumulator, member) => {
            accumulator[member.id] = chores.filter((chore) => chore.assigneeId === member.id).length;
            return accumulator;
        }, {}),
        [chores, members],
    );
    const currentUserCredits = useMemo(() => {
        const raw = helpCredits[currentUserId];
        return Number.isFinite(raw) ? raw : 0;
    }, [currentUserId, helpCredits]);
    const monthStats = useMemo(() => monthDailyStats(chores, selectedMonth), [chores, selectedMonth]);
    const monthDays = useMemo(() => {
        const end = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
        return Array.from({ length: end }, (_, idx) => new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), idx + 1));
    }, [selectedMonth]);
    const monthCells = useMemo(() => {
        const startWeekday = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).getDay();
        const blanks = Array.from({ length: startWeekday }, () => null);
        return [
            ...blanks,
            ...monthDays.map((date) => {
                const key = dateKeyLocal(date);
                return { key, date, stats: monthStats[key] };
            }),
        ];
    }, [monthDays, monthStats, selectedMonth]);
    const selectedDayStats = selectedDayKey ? monthStats[selectedDayKey] : null;
    const isViewingToday = useMemo(() => isSameDay(activeDate, new Date()), [activeDate]);
    const displayCleanlinessScore = useMemo(() => {
        if (isViewingToday) return climate.cleanlinessScore;
        return selectedDayStats?.cleanlinessScore ?? climate.cleanlinessScore;
    }, [isViewingToday, selectedDayStats, climate.cleanlinessScore]);
    const todayKey = useMemo(() => dateKeyLocal(new Date()), []);
    const selectedDateLabel = useMemo(() => {
        const date = activeDate;
        return date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
    }, [activeDate]);

    const weatherClass = `weather-${weather}`;
    const showEventLog = false;

    const track = (type, payload) => {
        setEvents((prev) => pushEvent(prev, type, payload));
    };

    const syncHelpCreditsState = (reason) => {
        const ensured = ensureHelpCreditsForWeek(members, helpCredits, helpCreditsWeekKey);
        if (!isSameCreditBook(ensured.credits, helpCredits)) {
            setHelpCredits(ensured.credits);
        }
        if (ensured.weekKey !== helpCreditsWeekKey) {
            setHelpCreditsWeekKey(ensured.weekKey);
        }
        if (ensured.didReset) {
            track('help_credit_weekly_reset', {
                workspaceId: workspace.id,
                weekKey: ensured.weekKey,
                reason,
            });
        }
        return ensured;
    };

    useEffect(() => {
        if (weatherRef.current !== weather) {
            track('weather_state_change', {
                from: weatherRef.current,
                to: weather,
                dirtiness: climate.dirtinessScore,
                harmony: climate.harmonyScore,
            });
            weatherRef.current = weather;
        }
    }, [weather, climate.dirtinessScore, climate.harmonyScore]);

    useEffect(() => {
        const today = new Date();
        const defaultKey = isSameMonth(today, selectedMonth)
            ? dateKeyLocal(today)
            : dateKeyLocal(selectedMonth);
        const monthKey = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;
        setSelectedDayKey((prev) => (prev && prev.startsWith(monthKey) ? prev : defaultKey));
        track('calendar_view', { month: monthKey });
    }, [selectedMonth]);

    useEffect(() => {
        if (selectedDayKey) {
            setNewDate(selectedDayKey);
        }
    }, [selectedDayKey]);

    useEffect(() => {
        if (quickAddOpen && newTitleInputRef.current) {
            newTitleInputRef.current.focus();
        }
    }, [quickAddOpen]);

    useEffect(() => {
        if (!activeMembers.length) return;
        if (!activeMembers.some((member) => member.id === newAssignee)) {
            setNewAssignee(activeMembers[0].id);
        }
    }, [activeMembers, newAssignee]);

    useEffect(() => {
        if (!activeMembers.length) return;
        if (!activeMembers.some((member) => member.id === editAssignee)) {
            setEditAssignee(activeMembers[0].id);
        }
    }, [activeMembers, editAssignee]);

    useEffect(() => {
        if (members.length === 0) return;
        const nextCurrentUserId = resolveCurrentUserId(members, accountUser.id);
        if (nextCurrentUserId && nextCurrentUserId !== currentUserId) {
            setCurrentUserId(nextCurrentUserId);
        }
    }, [currentUserId, members]);

    useEffect(() => {
        if (!workspace?.id) return;
        setSpaces((prev) => {
            const snapshot = {
                id: workspace.id,
                name: workspace.name,
                members,
                chores,
                events,
                currentUserId: currentUserId || resolveCurrentUserId(members, accountUser.id),
                helpCredits,
                helpCreditsWeekKey,
                lastUsedAt: new Date().toISOString(),
            };

            const exists = prev.some((item) => item.id === workspace.id);
            if (!exists) {
                return [...prev, snapshot];
            }

            return prev.map((item) => (item.id === workspace.id ? snapshot : item));
        });
    }, [chores, currentUserId, events, helpCredits, helpCreditsWeekKey, members, workspace]);

    useEffect(() => {
        return () => {
            if (acceptTimerRef.current) {
                clearTimeout(acceptTimerRef.current);
            }
            if (clearHighlightTimerRef.current) {
                clearTimeout(clearHighlightTimerRef.current);
            }
            if (clearToastTimerRef.current) {
                clearTimeout(clearToastTimerRef.current);
            }
            Object.values(completionUndoTimersRef.current).forEach((timerId) => {
                clearTimeout(timerId);
            });
        };
    }, []);

    useEffect(() => {
        const entries = Object.keys(completionUndoById);
        if (entries.length === 0) return undefined;

        const timerId = setInterval(() => {
            setCompletionCountdownNow(Date.now());
        }, 200);

        return () => {
            clearInterval(timerId);
        };
    }, [completionUndoById]);

    const toggleChore = (id) => {
        setChores((prev) =>
            prev.map((item) => {
                if (item.id !== id) return item;
                const nextDone = !item.done;
                return {
                    ...item,
                    done: nextDone,
                    doneAt: nextDone ? new Date().toISOString() : null,
                };
            }),
        );
        track('chore_toggle', { id });
    };

    const clearCompletionUndo = (choreId) => {
        const timerId = completionUndoTimersRef.current[choreId];
        if (timerId) {
            clearTimeout(timerId);
            delete completionUndoTimersRef.current[choreId];
        }
        setCompletionUndoById((prev) => {
            if (!prev[choreId]) return prev;
            const next = { ...prev };
            delete next[choreId];
            return next;
        });
    };

    const finalizePendingCompletion = (choreId) => {
        clearCompletionUndo(choreId);
        setCompletionSlideById((prev) => ({
            ...prev,
            [choreId]: 0,
        }));
        setChores((prev) =>
            prev.map((item) =>
                item.id === choreId && !item.done
                    ? {
                        ...item,
                        done: true,
                        doneAt: new Date().toISOString(),
                    }
                    : item,
            ),
        );
        track('chore_toggle', { id: choreId, source: 'pending_completion_finalized' });
    };

    const openCompletionUndoWindow = (choreId) => {
        clearCompletionUndo(choreId);
        const expiresAt = Date.now() + COMPLETION_UNDO_WINDOW_MS;
        setCompletionUndoById((prev) => ({
            ...prev,
            [choreId]: expiresAt,
        }));
        completionUndoTimersRef.current[choreId] = setTimeout(() => {
            finalizePendingCompletion(choreId);
        }, COMPLETION_UNDO_WINDOW_MS);
    };

    const revertCompletedChore = (choreId, reason = 'manual_revert') => {
        clearCompletionUndo(choreId);
        toggleChore(choreId);
        track('chore_revert_to_todo', { choreId, reason });
    };

    const cancelPendingCompletion = (choreId, reason = 'pending_completion_cancel') => {
        clearCompletionUndo(choreId);
        setCompletionSlideById((prev) => ({
            ...prev,
            [choreId]: 0,
        }));
        track('chore_revert_to_todo', { choreId, reason });
    };

    const handleUndoClick = (choreId) => {
        if (!completionUndoById[choreId]) return;
        cancelPendingCompletion(choreId, 'undo_window_click');
    };

    const updateCompletionSlide = (choreId, value) => {
        setCompletionSlideById((prev) => ({
            ...prev,
            [choreId]: value,
        }));
    };

    const commitCompletionSlide = (chore) => {
        const progress = completionSlideById[chore.id] ?? 0;
        if (!chore.done && progress >= 95) {
            setCompletionSlideById((prev) => ({
                ...prev,
                [chore.id]: 100,
            }));
            openCompletionUndoWindow(chore.id);
            track('chore_completion_pending', { choreId: chore.id, windowMs: COMPLETION_UNDO_WINDOW_MS });
            return;
        }

        setCompletionSlideById((prev) => ({
            ...prev,
            [chore.id]: 0,
        }));
    };

    const remainingUndoSeconds = (choreId) => {
        const expiresAt = completionUndoById[choreId];
        if (!expiresAt) return 0;
        const remainingMs = Math.max(0, expiresAt - completionCountdownNow);
        return Math.ceil(remainingMs / 1000);
    };

    const addChore = (event) => {
        event.preventDefault();

        const normalizedTitle = newTitle.trim();
        if (!normalizedTitle) {
            setFormError('請輸入工作名稱');
            return;
        }

        const weight = Number(newWeight);
        if (Number.isNaN(weight) || weight < 1 || weight > 5) {
            setFormError('權重需為 1-5');
            return;
        }

        if (!activeMembers.length) {
            setFormError('請先建立至少一位啟用中的成員');
            return;
        }

        if (!activeMembers.some((member) => member.id === newAssignee)) {
            setFormError('請選擇啟用中的指派成員');
            return;
        }

        const chore = {
            id: `c-${Date.now()}`,
            title: normalizedTitle,
            weight,
            done: false,
            assigneeId: newAssignee,
            doneAt: null,
            date: newDate,
            recurrence: newRecurrence,
        };

        const assigneeName = memberById[chore.assigneeId]?.name || '未分配';

        setChores((prev) => [chore, ...prev]);
        setFormError('');
        setEditError('');
        setNewTitle('');
        setNewWeight(3);
        setNewRecurrence('none');
        setDeleteConfirmId(null);
        setSwapStatus(`已新增工作：${chore.title}`);
        setSuccessToast(`＋ ${chore.title} 已加入今日家務`);
        setQuickAddOpen(false);

        if (newTitleInputRef.current) {
            newTitleInputRef.current.focus();
        }

        if (clearToastTimerRef.current) {
            clearTimeout(clearToastTimerRef.current);
        }
        clearToastTimerRef.current = setTimeout(() => {
            setSuccessToast('');
        }, 2200);

        track('chore_add', {
            choreId: chore.id,
            title: chore.title,
            weight: chore.weight,
            assigneeId: chore.assigneeId,
            assigneeName,
            date: chore.date,
            recurrence: chore.recurrence,
        });
    };

    const startEditChore = (chore) => {
        setEditingChoreId(chore.id);
        setEditTitle(chore.title);
        setEditWeight(chore.weight);
        setEditAssignee(chore.assigneeId || activeMembers[0]?.id || '');
        setEditDate(chore.date || dateKeyLocal(new Date()));
        setEditRecurrence(chore.recurrence || 'none');
        setDeleteConfirmId(null);
        setEditError('');
        track('chore_edit_open', { choreId: chore.id });
    };

    const cancelEditChore = () => {
        setEditingChoreId(null);
        setEditError('');
        track('chore_edit_cancel');
    };

    const saveEditChore = (choreId) => {
        const normalizedTitle = editTitle.trim();
        if (!normalizedTitle) {
            setEditError('請輸入工作名稱');
            return;
        }

        const weight = Number(editWeight);
        if (Number.isNaN(weight) || weight < 1 || weight > 5) {
            setEditError('權重需為 1-5');
            return;
        }

        if (!activeMembers.some((member) => member.id === editAssignee)) {
            setEditError('請選擇啟用中的指派成員');
            return;
        }

        if (!editDate) {
            setEditError('請選擇日期');
            return;
        }

        setChores((prev) =>
            prev.map((item) =>
                item.id === choreId
                    ? {
                        ...item,
                        title: normalizedTitle,
                        weight,
                        assigneeId: editAssignee,
                        date: editDate,
                        recurrence: editRecurrence,
                    }
                    : item,
            ),
        );
        const assigneeName = memberById[editAssignee]?.name || '未分配';
        setEditingChoreId(null);
        setEditError('');
        setSwapStatus(`已更新工作：${normalizedTitle}`);
        setSuccessToast('✓ 工作已更新');
        if (clearToastTimerRef.current) {
            clearTimeout(clearToastTimerRef.current);
        }
        clearToastTimerRef.current = setTimeout(() => {
            setSuccessToast('');
        }, 2200);
        track('chore_edit_save', {
            choreId,
            title: normalizedTitle,
            weight,
            assigneeId: editAssignee,
            assigneeName,
            date: editDate,
            recurrence: editRecurrence,
        });
    };

    const openManagement = (tab = 'space') => {
        if (tab === 'members' && !canManageMembers) {
            setSwapStatus('你目前是 Member，僅 Owner/Admin 可管理人員');
            return;
        }
        setManagementTab(tab);
        setMemberError('');
        setManagementOpen(true);
        track('management_center_open', { tab });
    };

    const closeManagement = () => {
        setManagementOpen(false);
        setMemberError('');
        track('management_center_close');
    };

    const addMember = (event) => {
        event.preventDefault();
        if (!canManageMembers) {
            setMemberError('僅 Owner/Admin 可新增成員');
            return;
        }
        const normalizedName = newMemberName.trim();
        const normalizedEmoji = newMemberEmoji.trim();

        if (!normalizedName) {
            setMemberError('請輸入成員名稱');
            return;
        }

        if (members.some((member) => member.name.toLowerCase() === normalizedName.toLowerCase())) {
            setMemberError('成員名稱不可重複');
            return;
        }

        const member = {
            id: `m-${Date.now()}`,
            name: normalizedName,
            emoji: normalizedEmoji || '🙂',
            active: true,
            role: 'member',
        };

        setMembers((prev) => [...prev, member]);
        setHelpCredits((prev) => ({
            ...prev,
            [member.id]: HELP_CREDIT_WEEKLY_LIMIT,
        }));
        setNewMemberName('');
        setNewMemberEmoji('🙂');
        setMemberError('');
        setSwapStatus(`已新增成員：${member.name}`);
        track('member_add', { memberId: member.id, name: member.name });
    };

    const updateMemberName = (memberId, nextName) => {
        if (!canManageMembers) return;
        setMembers((prev) => prev.map((member) => (member.id === memberId ? { ...member, name: nextName } : member)));
    };

    const commitMemberName = (memberId, rawName) => {
        if (!canManageMembers) {
            setMemberError('僅 Owner/Admin 可修改成員');
            return;
        }
        const normalizedName = rawName.trim();
        if (!normalizedName) {
            setMemberError('成員名稱不可為空');
            return;
        }
        if (members.some((member) => member.id !== memberId && member.name.toLowerCase() === normalizedName.toLowerCase())) {
            setMemberError('成員名稱不可重複');
            return;
        }
        setMembers((prev) => prev.map((member) => (member.id === memberId ? { ...member, name: normalizedName } : member)));
        setMemberError('');
        track('member_edit_name', { memberId, name: normalizedName });
    };

    const updateMemberEmoji = (memberId, nextEmoji) => {
        if (!canManageMembers) return;
        const normalizedEmoji = nextEmoji.trim();
        setMembers((prev) => prev.map((member) => (member.id === memberId ? { ...member, emoji: normalizedEmoji || '🙂' } : member)));
        track('member_edit_emoji', { memberId });
    };

    const updateMemberRole = (memberId, nextRole) => {
        if (currentUser?.role !== 'owner') {
            setMemberError('僅 Owner 可調整角色');
            return;
        }

        const target = members.find((member) => member.id === memberId);
        if (!target) return;
        if (target.role === 'owner') {
            setMemberError('Owner 角色不可變更');
            return;
        }

        setMembers((prev) => prev.map((member) => (member.id === memberId ? { ...member, role: nextRole } : member)));
        setMemberError('');
        track('member_edit_role', { memberId, role: nextRole });
    };

    const toggleMemberActive = (memberId) => {
        if (!canManageMembers) {
            setMemberError('僅 Owner/Admin 可停用成員');
            return;
        }
        const target = members.find((member) => member.id === memberId);
        if (!target) return;

        if (target.role === 'owner') {
            setMemberError('Owner 不可停用');
            return;
        }

        if (target.active && activeMembers.length <= 1) {
            setMemberError('至少需要一位啟用中的成員');
            return;
        }

        const assignedCount = chores.filter((item) => item.assigneeId === memberId).length;
        if (target.active && assignedCount > 0) {
            setMemberError(`「${target.name}」仍有 ${assignedCount} 筆任務，請先重指派`);
            return;
        }

        setMembers((prev) => prev.map((member) => (member.id === memberId ? { ...member, active: !member.active } : member)));
        setMemberError('');
        track('member_toggle_active', { memberId, active: !target.active });
    };

    const deleteMember = (memberId) => {
        if (!canManageMembers) {
            setMemberError('僅 Owner/Admin 可刪除成員');
            return;
        }
        const target = members.find((member) => member.id === memberId);
        if (!target) return;

        if (target.role === 'owner') {
            setMemberError('Owner 不可刪除');
            return;
        }

        if (target.id === currentUserId) {
            setMemberError('不可刪除目前登入使用者');
            return;
        }

        const assignedCount = chores.filter((item) => item.assigneeId === memberId).length;
        if (assignedCount > 0) {
            setMemberError(`「${target.name}」仍有 ${assignedCount} 筆任務，請先重指派`);
            return;
        }

        setMembers((prev) => prev.filter((member) => member.id !== memberId));
        setHelpCredits((prev) => {
            const next = { ...prev };
            delete next[memberId];
            return next;
        });
        setMemberError('');
        setSwapStatus(`已刪除成員：${target.name}`);
        track('member_delete', { memberId, name: target.name });
    };

    const switchWorkspace = (workspaceId) => {
        const targetSpace = spaces.find((item) => item.id === workspaceId);
        if (!targetSpace) return;

        if (workspace.id === workspaceId) {
            setManagementOpen(false);
            return;
        }

        if (acceptTimerRef.current) {
            clearTimeout(acceptTimerRef.current);
            acceptTimerRef.current = null;
        }
        if (clearHighlightTimerRef.current) {
            clearTimeout(clearHighlightTimerRef.current);
            clearHighlightTimerRef.current = null;
        }
        if (clearToastTimerRef.current) {
            clearTimeout(clearToastTimerRef.current);
            clearToastTimerRef.current = null;
        }

        const nextCurrentUserId = resolveCurrentUserId(targetSpace.members, accountUser.id);
        const ensuredCredits = ensureHelpCreditsForWeek(
            targetSpace.members,
            targetSpace.helpCredits || {},
            targetSpace.helpCreditsWeekKey,
        );

        setWorkspace({ id: targetSpace.id, name: targetSpace.name });
        setMembers(targetSpace.members);
        setChores(targetSpace.chores);
        setEvents(targetSpace.events || []);
        setHelpCredits(ensuredCredits.credits);
        setHelpCreditsWeekKey(ensuredCredits.weekKey);
        setCurrentUserId(nextCurrentUserId);
        setNewAssignee(nextCurrentUserId || targetSpace.members.find((member) => member.active)?.id || '');
        setEditAssignee(nextCurrentUserId || targetSpace.members.find((member) => member.active)?.id || '');
        setSelectedChoreId(null);
        setSwapOpen(false);
        setSwapSubmitting(false);
        setManagementOpen(false);
        setQuickAddOpen(false);
        setCreateSpaceOpen(false);
        setEditingChoreId(null);
        setDeleteConfirmId(null);
        setEditError('');
        setFormError('');
        setMemberError('');
        setHighlightedChoreId(null);
        setSwapStatus(`已切換到空間：${targetSpace.name}`);
        setSuccessToast(`✓ 已切換至 ${targetSpace.name}`);
        clearToastTimerRef.current = setTimeout(() => {
            setSuccessToast('');
        }, 2200);

        track('workspace_switch', { workspaceId: targetSpace.id, workspaceName: targetSpace.name });
        if (ensuredCredits.didReset) {
            track('help_credit_weekly_reset', {
                workspaceId: targetSpace.id,
                weekKey: ensuredCredits.weekKey,
                reason: 'switch_workspace',
            });
        }
    };

    const openCreateSpace = () => {
        setNewSpaceName('');
        setNewOwnerEmoji(currentUser?.emoji || '🙂');
        setSpaceError('');
        setManagementOpen(false);
        setCreateSpaceOpen(true);
        track('workspace_create_open');
    };

    const closeCreateSpace = (backToManagement = true) => {
        setCreateSpaceOpen(false);
        setSpaceError('');
        if (backToManagement) {
            setManagementTab('space');
            setManagementOpen(true);
        }
        track('workspace_create_close', { backToManagement });
    };

    const createWorkspace = (event) => {
        event.preventDefault();
        const workspaceName = newSpaceName.trim();
        const ownerName = currentUser?.name || accountUser.name;
        const ownerEmoji = newOwnerEmoji.trim() || '🙂';

        if (!workspaceName) {
            setSpaceError('請輸入空間名稱');
            return;
        }

        const workspaceId = `w-${Date.now()}`;
        const ownerId = `m-${Date.now()}`;
        const ownerMember = {
            id: ownerId,
            name: ownerName,
            emoji: ownerEmoji,
            active: true,
            role: 'owner',
            userId: accountUser.id,
        };
        const initialCredits = {
            [ownerId]: HELP_CREDIT_WEEKLY_LIMIT,
        };
        const initialWeek = mondayWeekKeyFrom(new Date());

        if (acceptTimerRef.current) {
            clearTimeout(acceptTimerRef.current);
            acceptTimerRef.current = null;
        }
        if (clearHighlightTimerRef.current) {
            clearTimeout(clearHighlightTimerRef.current);
            clearHighlightTimerRef.current = null;
        }
        if (clearToastTimerRef.current) {
            clearTimeout(clearToastTimerRef.current);
            clearToastTimerRef.current = null;
        }

        setWorkspace({ id: workspaceId, name: workspaceName });
        setMembers([ownerMember]);
        setChores([]);
        setHelpCredits(initialCredits);
        setHelpCreditsWeekKey(initialWeek);
        setCurrentUserId(resolveCurrentUserId([ownerMember], accountUser.id));
        setNewAssignee(ownerId);
        setEditAssignee(ownerId);
        setSelectedChoreId(null);
        setSwapOpen(false);
        setSwapSubmitting(false);
        setManagementOpen(false);
        setQuickAddOpen(false);
        setEditingChoreId(null);
        setDeleteConfirmId(null);
        setEditError('');
        setFormError('');
        setMemberError('');
        setHighlightedChoreId(null);
        setEvents([]);
        setSwapStatus(`已建立新空間：${workspaceName}`);
        setSuccessToast(`✓ ${workspaceName} 已建立`);
        clearToastTimerRef.current = setTimeout(() => {
            setSuccessToast('');
        }, 2200);
        setCreateSpaceOpen(false);
        setSpaceError('');
        track('workspace_create', { workspaceId, workspaceName, ownerId, ownerName });
    };

    const requestDeleteChore = (choreId) => {
        setDeleteConfirmId(choreId);
        setEditingChoreId(null);
        setEditError('');
        track('chore_delete_request', { choreId });
    };

    const toggleListEditMode = () => {
        setListEditMode((prev) => {
            const next = !prev;
            if (!next) {
                setEditingChoreId(null);
                setDeleteConfirmId(null);
                setEditError('');
            }
            track('list_edit_mode_toggle', { enabled: next });
            return next;
        });
    };

    const cancelDeleteChore = () => {
        setDeleteConfirmId(null);
        track('chore_delete_cancel');
    };

    const confirmDeleteChore = (choreId) => {
        const target = chores.find((item) => item.id === choreId);
        setChores((prev) => prev.filter((item) => item.id !== choreId));
        setDeleteConfirmId(null);
        setSwapStatus(target ? `已刪除工作：${target.title}` : '已刪除工作');
        setSuccessToast('✓ 已刪除');
        if (clearToastTimerRef.current) {
            clearTimeout(clearToastTimerRef.current);
        }
        clearToastTimerRef.current = setTimeout(() => {
            setSuccessToast('');
        }, 2200);
        track('chore_delete_confirm', { choreId });
    };

    const goToPrevMonth = () => {
        const next = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);
        setSelectedMonth(next);
        setSelectedDayKey(null);
        track('calendar_month_change', { direction: 'prev', month: next.getMonth() + 1 });
    };

    const goToNextMonth = () => {
        const next = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
        setSelectedMonth(next);
        setSelectedDayKey(null);
        track('calendar_month_change', { direction: 'next', month: next.getMonth() + 1 });
    };

    const selectDay = (key) => {
        setSelectedDayKey(key);
        track('calendar_day_open', { day: key });
    };

    const toggleCalendarCollapsed = () => {
        setCalendarCollapsed((prev) => {
            const next = !prev;
            track('calendar_toggle', { collapsed: next });
            return next;
        });
    };

    const openQuickAdd = () => {
        setFormError('');
        setQuickAddOpen(true);
        track('quick_add_open', { source: 'hub_head' });
    };

    const closeQuickAdd = () => {
        setQuickAddOpen(false);
        track('quick_add_close');
    };

    const openSwap = () => {
        const ensured = syncHelpCreditsState('open_swap');
        const credits = ensured.credits[currentUserId] ?? 0;
        if (credits < HELP_CREDIT_SPEND) {
            setSwapStatus(`本週求援次數不足（剩餘 ${formatCredit(credits)}）`);
            track('help_credit_blocked', { currentUserId, credits, reason: 'open_swap' });
            return;
        }
        if (!pending.length) {
            setSwapStatus('目前沒有可換手任務，太棒了！');
            track('swap_open_empty');
            return;
        }
        setSelectedChoreId(pending[0].id);
        setSwapSubmitting(false);
        setSwapOpen(true);
        setSwapStatus('選擇一個任務發出求援');
        track('swap_open');
    };

    const closeSwap = () => {
        setSwapOpen(false);
        setSwapSubmitting(false);
        track('swap_close');
    };

    const requestHelp = (targetMemberId = null) => {
        if (swapSubmitting) return;

        const ensured = syncHelpCreditsState('request_help');
        const availableCredits = ensured.credits[currentUserId] ?? 0;
        if (availableCredits < HELP_CREDIT_SPEND) {
            setSwapStatus(`本週求援次數不足（剩餘 ${formatCredit(availableCredits)}）`);
            setSwapOpen(false);
            track('help_credit_blocked', { currentUserId, credits: availableCredits, reason: 'request_help' });
            return;
        }

        const chore = chores.find((item) => item.id === selectedChoreId) || pending[0];
        if (!chore) {
            setSwapStatus('目前沒有待處理任務可求援。');
            setSwapOpen(false);
            return;
        }

        const helperCandidates = activeMembers.filter((member) => member.id !== chore.assigneeId);
        if (!helperCandidates.length) {
            setSwapStatus('目前沒有其他可接手成員，暫時無法求援。');
            setSwapOpen(false);
            return;
        }

        let helperMemberId = null;
        let helperMember = null;

        if (targetMemberId) {
            const targeted = helperCandidates.find((member) => member.id === targetMemberId);
            if (!targeted) {
                setSwapStatus('指定成員目前不可接手，請重新選擇。');
                return;
            }
            helperMember = targeted;
            helperMemberId = helperMember.id;
            const helperName = memberById[helperMemberId]?.name || '隊友';
            setSwapStatus(`已向 ${helperName} 送出求援：${chore.title}`);
            track('swap_request_targeted', { choreId: chore.id, targetMemberId: helperMemberId, targetName: helperName });
        } else {
            const randomIndex = Math.floor(Math.random() * helperCandidates.length);
            helperMember = helperCandidates[randomIndex];
            helperMemberId = helperMember.id;
            setSwapStatus(`已廣播求援：${chore.title}，等待隊友回應中。`);
            track('swap_request_broadcast', { choreId: chore.id });
        }

        const spentCredits = Math.max(0, roundCreditToHalf(availableCredits - HELP_CREDIT_SPEND));
        const nextCredits = {
            ...ensured.credits,
            [currentUserId]: spentCredits,
        };
        setHelpCredits(nextCredits);
        track('help_credit_spent', {
            workspaceId: workspace.id,
            userId: currentUserId,
            before: availableCredits,
            after: spentCredits,
            choreId: chore.id,
        });

        setSwapSubmitting(true);
        setSwapOpen(false);

        if (acceptTimerRef.current) {
            clearTimeout(acceptTimerRef.current);
        }
        if (clearHighlightTimerRef.current) {
            clearTimeout(clearHighlightTimerRef.current);
        }
        if (clearToastTimerRef.current) {
            clearTimeout(clearToastTimerRef.current);
        }

        acceptTimerRef.current = setTimeout(() => {
            setChores((prev) =>
                prev.map((item) =>
                    item.id === chore.id ? { ...item, assigneeId: helperMemberId } : item,
                ),
            );

            setHelpCredits((prev) => {
                const helperBefore = Number(prev[helperMemberId]);
                const normalizedBefore = Number.isFinite(helperBefore) ? helperBefore : HELP_CREDIT_WEEKLY_LIMIT;
                const helperAfter = Math.min(
                    HELP_CREDIT_WEEKLY_LIMIT,
                    roundCreditToHalf(normalizedBefore + HELP_CREDIT_EARN),
                );

                track('help_credit_earned', {
                    workspaceId: workspace.id,
                    userId: helperMemberId,
                    before: normalizedBefore,
                    after: helperAfter,
                    choreId: chore.id,
                });

                return {
                    ...prev,
                    [helperMemberId]: helperAfter,
                };
            });

            const helperName = memberById[helperMemberId]?.name || '隊友';
            setSwapStatus(`換手成功：${chore.title} → ${helperName}`);
            setSuccessToast(`✓ ${chore.title} 已由 ${helperName} 接手`);
            setHighlightedChoreId(chore.id);
            setSwapSubmitting(false);

            track('swap_accepted', {
                choreId: chore.id,
                newAssigneeId: helperMemberId,
                newAssigneeName: helperName,
            });

            clearHighlightTimerRef.current = setTimeout(() => {
                setHighlightedChoreId(null);
            }, 2400);

            clearToastTimerRef.current = setTimeout(() => {
                setSuccessToast('');
            }, 2600);
        }, 700);
    };

    const exportEvents = () => {
        const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `homejoy-usability-events-${Date.now()}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        track('events_export');
    };

    const currentUserIdentity = currentUser
        ? `${currentUser.name} (${roleLabel(currentUser.role)})`
        : accountUser.name;
    const currentUserAvatar = currentUser?.emoji || '👤';

    return (
        <div className={`page ${weatherClass}`}>
            <main className="app-shell">
                <section className="top-panel" aria-label="控制與概況區">
                    <section className="control-hub" aria-label="顯示與新增控制中心">
                        <div className="hub-head">
                            <div className="hub-title-row">
                                <button type="button" className="workspace-chip workspace-chip-button" onClick={() => openManagement('space')}>
                                    {workspace.name}
                                </button>
                                <span
                                    className="workspace-user-avatar"
                                    role="img"
                                    aria-label={`登入身份：${currentUserIdentity}`}
                                    title={`登入身份：${currentUserIdentity}`}
                                >
                                    {currentUserAvatar}
                                </span>
                            </div>
                        </div>

                        <section className="dirtiness-card hub-panel" aria-label="乾淨指數與每月進度">
                            <div className="dirtiness-head">
                                <div className="hero-side hero-side-solo">
                                    <p className="hero-icon">
                                        <span className="hero-icon-mark" aria-hidden="true">{weatherIcon}</span>
                                        <span className="hero-icon-text">乾淨指數</span>
                                    </p>
                                    <strong>{`${displayCleanlinessScore}%`}</strong>
                                    <p className="hero-hint">{selectedDateLabel} · 待處理 {pending.length} 件</p>
                                </div>
                                <button
                                    type="button"
                                    className="calendar-toggle-btn dirtiness-toggle-btn"
                                    onClick={toggleCalendarCollapsed}
                                    aria-expanded={!calendarCollapsed}
                                >
                                    {calendarCollapsed ? '查看每月進度' : '收起每月進度'}
                                </button>
                            </div>

                            {!calendarCollapsed && (
                                <div className="dirtiness-monthly">
                                    <div className="calendar-head">
                                        <div>
                                            <p className="calendar-title">回顧日曆</p>
                                            <strong className="calendar-month">{selectedMonth.toLocaleString('zh-TW', { year: 'numeric', month: 'long' })}</strong>
                                        </div>
                                        <div className="calendar-nav" aria-label="月份切換">
                                            <button type="button" onClick={goToPrevMonth} aria-label="上一個月">
                                                ‹
                                            </button>
                                            <button type="button" onClick={goToNextMonth} aria-label="下一個月">
                                                ›
                                            </button>
                                        </div>
                                    </div>

                                    <div className="calendar-weekdays">
                                        {['日', '一', '二', '三', '四', '五', '六'].map((label) => (
                                            <span key={label}>{label}</span>
                                        ))}
                                    </div>
                                    <div className="calendar-grid" role="grid">
                                        {monthCells.map((cell, idx) =>
                                            cell ? (
                                                <button
                                                    key={cell.key}
                                                    className={`calendar-cell ${cell.stats?.weather || 'empty'} ${selectedDayKey === cell.key ? 'active' : ''}`}
                                                    onClick={() => selectDay(cell.key)}
                                                    role="gridcell"
                                                    aria-pressed={selectedDayKey === cell.key}
                                                >
                                                    <span className="calendar-day">{cell.date.getDate()}</span>
                                                    <span className="calendar-metric">
                                                        {cell.stats
                                                            ? `${cell.key === todayKey ? climate.cleanlinessScore : cell.stats.cleanlinessScore}%`
                                                            : '--'}
                                                    </span>
                                                </button>
                                            ) : (
                                                <span key={`blank-${idx}`} className="calendar-cell placeholder" aria-hidden="true" />
                                            ),
                                        )}
                                    </div>
                                    <div className="calendar-legend">
                                        <span className="legend-item"><span className="dot sunny" /> 晴 ≥ 80</span>
                                        <span className="legend-item"><span className="dot cloudy" /> 多雲 ≥ 55</span>
                                        <span className="legend-item"><span className="dot overcast" /> 陰 ≥ 30</span>
                                        <span className="legend-item"><span className="dot rainy" /> 雨 &lt; 30</span>
                                    </div>
                                </div>
                            )}
                        </section>

                        {successToast && <p className="toast success">{successToast}</p>}

                    </section>

                </section>

                <section className="content-panel" aria-label="工作與事件區">
                    <section className="bubbles" aria-label="工作清單管理">
                        <div className="section-head">
                            <h3 className="section-title">工作清單管理</h3>
                            <div className="section-actions">
                                <button
                                    type="button"
                                    className={`list-edit-toggle ${listEditMode ? 'active' : ''}`}
                                    onClick={toggleListEditMode}
                                >
                                    {listEditMode ? '完成編輯' : '編輯'}
                                </button>
                                <button type="button" className="list-quick-add" onClick={openQuickAdd}>
                                    ＋ 快速新增
                                </button>
                            </div>
                        </div>
                        <div className="list-group">
                            {visibleChores.map((chore) => {
                                const assigneeMember = memberById[chore.assigneeId];
                                const assigneeLabel = assigneeMember?.name || '未分配';
                                return (
                                    <article key={chore.id} className={`bubble ${chore.done ? 'done' : ''} ${highlightedChoreId === chore.id ? 'highlight' : ''}`}>
                                        {editingChoreId === chore.id ? (
                                            <div className="card-edit">
                                                <input
                                                    className="chore-input"
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    placeholder="工作名稱"
                                                />
                                                <div className="card-edit-row">
                                                    <select
                                                        className="chore-select"
                                                        value={editWeight}
                                                        onChange={(e) => setEditWeight(Number(e.target.value))}
                                                    >
                                                        {[1, 2, 3, 4, 5].map((weight) => (
                                                            <option key={weight} value={weight}>{weight}</option>
                                                        ))}
                                                    </select>
                                                    <select
                                                        className="chore-select"
                                                        value={editAssignee}
                                                        onChange={(e) => setEditAssignee(e.target.value)}
                                                    >
                                                        {activeMembers.map((member) => (
                                                            <option key={member.id} value={member.id}>{member.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="card-edit-row">
                                                    <input
                                                        type="date"
                                                        className="chore-input"
                                                        value={editDate}
                                                        onChange={(e) => setEditDate(e.target.value)}
                                                    />
                                                    <select
                                                        className="chore-select"
                                                        value={editRecurrence}
                                                        onChange={(e) => setEditRecurrence(e.target.value)}
                                                    >
                                                        <option value="none">不重複</option>
                                                        <option value="daily">每日</option>
                                                        <option value="weekly">每週</option>
                                                        <option value="monthly">每月</option>
                                                    </select>
                                                </div>
                                                {editError && <p className="form-error">{editError}</p>}
                                                <div className="card-actions">
                                                    <button type="button" onClick={() => saveEditChore(chore.id)}>儲存</button>
                                                    <button type="button" onClick={cancelEditChore}>取消</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="card-head">
                                                    <div className="card-title-row">
                                                        <h4 className="card-title">{chore.title}</h4>
                                                        <span className={`weight-chip ${weightTone(chore.weight)}`} aria-label={`任務比重 ${chore.weight}`}>
                                                            {chore.weight}
                                                        </span>
                                                    </div>
                                                    <span className={`card-state ${chore.done ? 'done' : 'todo'}`}>{chore.done ? '已完成' : '待處理'}</span>
                                                </div>
                                                <p className="meta">
                                                    <span className="card-assignee">
                                                        <span className="card-assignee-face" aria-hidden="true">{assigneeMember?.emoji || '👤'}</span>
                                                        <span>{assigneeLabel}</span>
                                                    </span>
                                                    <span> · {recurrenceLabel(chore.recurrence)}</span>
                                                </p>
                                                {!chore.done ? (
                                                    <div className="slide-complete" aria-label="滑動完成任務">
                                                        <input
                                                            id={`complete-${chore.id}`}
                                                            className="slide-complete-range"
                                                            type="range"
                                                            min={0}
                                                            max={100}
                                                            step={1}
                                                            value={completionSlideById[chore.id] ?? 0}
                                                            disabled={Boolean(completionUndoById[chore.id])}
                                                            onChange={(e) => updateCompletionSlide(chore.id, Number(e.target.value))}
                                                            onMouseUp={() => commitCompletionSlide(chore)}
                                                            onTouchEnd={() => commitCompletionSlide(chore)}
                                                            onKeyUp={() => commitCompletionSlide(chore)}
                                                            aria-label={`${chore.title} 完成滑塊`}
                                                            aria-valuemin={0}
                                                            aria-valuemax={100}
                                                            aria-valuenow={completionSlideById[chore.id] ?? 0}
                                                        />
                                                        {completionUndoById[chore.id] && (
                                                            <button
                                                                type="button"
                                                                className="slide-undo-btn"
                                                                onClick={() => handleUndoClick(chore.id)}
                                                            >
                                                                撤銷（{remainingUndoSeconds(chore.id)}s）
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="slide-complete-done-wrap">
                                                        <p className="slide-complete-done">已完成</p>
                                                    </div>
                                                )}
                                                {listEditMode && deleteConfirmId === chore.id ? (
                                                    <div className="card-actions danger">
                                                        <button type="button" onClick={() => confirmDeleteChore(chore.id)}>確認刪除</button>
                                                        <button type="button" onClick={cancelDeleteChore}>取消</button>
                                                    </div>
                                                ) : listEditMode ? (
                                                    <>
                                                        <div className="card-actions">
                                                            <button type="button" onClick={() => startEditChore(chore)}>編輯</button>
                                                            <button type="button" onClick={() => requestDeleteChore(chore.id)}>刪除</button>
                                                        </div>
                                                        {chore.done && (
                                                            <button
                                                                type="button"
                                                                className="card-reopen-btn"
                                                                onClick={() => revertCompletedChore(chore.id, 'edit_mode_reopen')}
                                                            >
                                                                改回未完成
                                                            </button>
                                                        )}
                                                    </>
                                                ) : null}
                                            </>
                                        )}
                                    </article>
                                );
                            })}
                        </div>

                        {visibleChores.length === 0 && (
                            <p className="calendar-empty">目前沒有工作，先在上方快速新增一筆吧。</p>
                        )}
                    </section>

                    <section className="action-deck" aria-label="換手與空間設定">
                        <button className="swap deck-action-btn" onClick={openSwap}>
                            One-Tap Swap
                        </button>
                        <div className="action-status" aria-label="求援狀態摘要">
                            <p className="credit-pill">
                                本週求援次數 <strong>{formatCredit(currentUserCredits)} / {HELP_CREDIT_WEEKLY_LIMIT}</strong>
                            </p>
                            {swapStatus && (
                                <p className="swap-notice" aria-live="polite">{swapStatus}</p>
                            )}
                        </div>
                        <section className="member-overview" aria-label="成員概況">
                            {members.map((member) => (
                                <div key={member.id} className={`member-overview-item ${member.active ? '' : 'inactive'}`}>
                                    <span className="member-overview-emoji" aria-hidden="true">{member.emoji}</span>
                                    <span className="member-overview-name">{member.name}</span>
                                    <small>{roleLabel(member.role)}</small>
                                    <small>{memberTaskCounts[member.id] || 0} tasks · 💳 {formatCredit(helpCredits[member.id] ?? 0)}</small>
                                </div>
                            ))}
                        </section>
                    </section>

                    {showEventLog && (
                        <section className="events-panel">
                            <div className="events-head">
                                <strong>Usability Events</strong>
                                <button className="link-btn" onClick={exportEvents}>
                                    Export JSON
                                </button>
                            </div>
                            <ul>
                                {events.length === 0 && <li className="event-empty">No events yet</li>}
                                {events.map((entry, index) => (
                                    <li key={`${entry.at}-${index}`}>
                                        <span>{entry.type}</span>
                                        <small>{new Date(entry.at).toLocaleTimeString()}</small>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </section>
            </main>

            {quickAddOpen && (
                <div className="modal" onClick={closeQuickAdd}>
                    <div className="sheet" onClick={(e) => e.stopPropagation()}>
                        <h3>快速新增工作</h3>
                        <p className="hub-context">將新增到 {selectedDateLabel} 的工作清單</p>
                        <form onSubmit={addChore} className="add-chore-form">
                            <input
                                ref={newTitleInputRef}
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder="新增一件工作（例如：擦餐桌）"
                                className="chore-input"
                            />
                            <div className="add-row">
                                <label>
                                    Weight
                                    <select
                                        value={newWeight}
                                        onChange={(e) => setNewWeight(Number(e.target.value))}
                                        className="chore-select"
                                    >
                                        {[1, 2, 3, 4, 5].map((weight) => (
                                            <option key={weight} value={weight}>
                                                {weight}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    Assignee
                                    <select
                                        value={newAssignee}
                                        onChange={(e) => setNewAssignee(e.target.value)}
                                        className="chore-select"
                                    >
                                        {activeMembers.map((member) => (
                                            <option key={member.id} value={member.id}>
                                                {member.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    日期
                                    <input
                                        type="date"
                                        value={newDate}
                                        onChange={(e) => setNewDate(e.target.value)}
                                        className="chore-input"
                                    />
                                </label>
                                <label>
                                    重複
                                    <select
                                        value={newRecurrence}
                                        onChange={(e) => setNewRecurrence(e.target.value)}
                                        className="chore-select"
                                    >
                                        <option value="none">不重複</option>
                                        <option value="daily">每日</option>
                                        <option value="weekly">每週</option>
                                        <option value="monthly">每月</option>
                                    </select>
                                </label>
                                <button type="submit" className="add-btn">
                                    新增
                                </button>
                            </div>
                        </form>
                        {formError && <p className="form-error">{formError}</p>}
                        <div className="sheet-actions">
                            <button onClick={closeQuickAdd}>關閉</button>
                        </div>
                    </div>
                </div>
            )}

            {managementOpen && (
                <div className="modal" onClick={closeManagement}>
                    <div className="sheet" onClick={(e) => e.stopPropagation()}>
                        <h3>管理中心</h3>
                        <div className="management-tabs" role="tablist" aria-label="管理中心分頁">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={managementTab === 'space'}
                                className={`management-tab ${managementTab === 'space' ? 'active' : ''}`}
                                onClick={() => setManagementTab('space')}
                            >
                                空間管理
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={managementTab === 'members'}
                                className={`management-tab ${managementTab === 'members' ? 'active' : ''}`}
                                onClick={() => canManageMembers && setManagementTab('members')}
                                disabled={!canManageMembers}
                            >
                                成員管理
                            </button>
                        </div>

                        {managementTab === 'space' ? (
                            <>
                                <div className="sheet-list space-sheet-list">
                                    {spaces.map((item) => {
                                        const memberForAccount = item.members.find((member) => member.userId === accountUser.id);
                                        const role = memberForAccount?.role || 'member';
                                        const memberCount = item.members.length;
                                        const choreCount = item.chores.length;
                                        return (
                                            <button
                                                key={item.id}
                                                className={`sheet-item space-sheet-item ${item.id === workspace.id ? 'active' : ''}`}
                                                onClick={() => switchWorkspace(item.id)}
                                            >
                                                <strong>{item.name}</strong>
                                                <small>{roleLabel(role)} · 成員 {memberCount} · 任務 {choreCount}</small>
                                                {item.id === workspace.id && <span className="space-current-tag">當前</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="sheet-actions">
                                    <button onClick={openCreateSpace}>＋ 建立新空間</button>
                                    <button onClick={closeManagement}>關閉</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="hub-context">
                                    目前使用者：{currentUser ? `${currentUser.name} (${roleLabel(currentUser.role)})` : '未設定'}
                                </p>
                                <div className="member-manager-list">
                                    {members.map((member) => (
                                        <div key={member.id} className="member-manager-item">
                                            <input
                                                className="member-emoji-input"
                                                value={member.emoji}
                                                onChange={(e) => updateMemberEmoji(member.id, e.target.value)}
                                                maxLength={2}
                                                disabled={!canManageMembers || member.role === 'owner'}
                                                aria-label={`${member.name} emoji`}
                                            />
                                            <input
                                                className="chore-input member-name-input"
                                                value={member.name}
                                                onChange={(e) => updateMemberName(member.id, e.target.value)}
                                                onBlur={(e) => commitMemberName(member.id, e.target.value)}
                                                disabled={!canManageMembers || member.role === 'owner'}
                                            />
                                            <select
                                                className="chore-select member-role-select"
                                                value={member.role}
                                                onChange={(e) => updateMemberRole(member.id, e.target.value)}
                                                disabled={currentUser?.role !== 'owner' || member.role === 'owner'}
                                            >
                                                <option value="owner">Owner</option>
                                                <option value="admin">Admin</option>
                                                <option value="member">Member</option>
                                            </select>
                                            <button
                                                type="button"
                                                className={`member-toggle-btn ${member.active ? 'active' : ''}`}
                                                onClick={() => toggleMemberActive(member.id)}
                                                disabled={!canManageMembers || member.role === 'owner'}
                                            >
                                                {member.active ? '啟用中' : '已停用'}
                                            </button>
                                            <button
                                                type="button"
                                                className="member-delete-btn"
                                                onClick={() => deleteMember(member.id)}
                                                disabled={!canManageMembers || member.role === 'owner' || member.id === currentUserId}
                                            >
                                                刪除
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <form className="member-add-form" onSubmit={addMember}>
                                    <input
                                        className="member-emoji-input"
                                        value={newMemberEmoji}
                                        onChange={(e) => setNewMemberEmoji(e.target.value)}
                                        maxLength={2}
                                        disabled={!canManageMembers}
                                        aria-label="new member emoji"
                                    />
                                    <input
                                        className="chore-input member-name-input"
                                        value={newMemberName}
                                        onChange={(e) => setNewMemberName(e.target.value)}
                                        placeholder="新增成員名稱"
                                        disabled={!canManageMembers}
                                    />
                                    <button type="submit" className="member-add-btn" disabled={!canManageMembers}>新增成員</button>
                                </form>
                                {memberError && <p className="form-error">{memberError}</p>}
                                <div className="sheet-actions">
                                    <button onClick={closeManagement}>完成</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )
            }

            {
                createSpaceOpen && (
                    <div className="modal" onClick={() => closeCreateSpace(true)}>
                        <div className="sheet sheet-create-space" onClick={(e) => e.stopPropagation()}>
                            <h3>新建家庭空間</h3>
                            <p className="hub-context">建立後會自動切換到新空間，不會覆蓋既有空間資料。</p>
                            <form className="add-chore-form create-space-form" onSubmit={createWorkspace}>
                                <label className="create-space-field">
                                    空間名稱
                                    <input
                                        className="chore-input"
                                        value={newSpaceName}
                                        onChange={(e) => setNewSpaceName(e.target.value)}
                                        placeholder="例如：Sunny Home"
                                    />
                                </label>
                                <p className="hub-context create-space-owner-label">Owner：{currentUser?.name || accountUser.name}</p>
                                <div className="create-space-owner-row">
                                    <input
                                        className="member-emoji-input"
                                        value={newOwnerEmoji}
                                        onChange={(e) => setNewOwnerEmoji(e.target.value)}
                                        maxLength={2}
                                        aria-label="owner emoji"
                                    />
                                    <p className="chore-input member-name-input owner-display">{currentUser?.name || accountUser.name}</p>
                                    <button type="submit" className="member-add-btn create-space-submit-btn">建立空間</button>
                                </div>
                            </form>
                            {spaceError && <p className="form-error">{spaceError}</p>}
                            <div className="sheet-actions">
                                <button onClick={() => closeCreateSpace(true)}>返回管理中心</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                swapOpen && (
                    <div className="modal" onClick={closeSwap}>
                        <div className="sheet" onClick={(e) => e.stopPropagation()}>
                            <h3>One-Tap Swap：選擇求援任務</h3>
                            {(() => {
                                const selected = chores.find((item) => item.id === selectedChoreId) || pending[0];
                                const candidates = selected
                                    ? activeMembers.filter((member) => member.id !== selected.assigneeId)
                                    : [];
                                const credits = helpCredits[currentUserId] ?? 0;
                                const canRequest = credits >= HELP_CREDIT_SPEND && !swapSubmitting;
                                return (
                                    <>
                                        <p className="hub-context">本週剩餘求援次數：{formatCredit(credits)} / {HELP_CREDIT_WEEKLY_LIMIT}</p>
                                        <div className="sheet-list">
                                            {pending.map((item) => (
                                                <button
                                                    key={item.id}
                                                    className={`sheet-item ${selectedChoreId === item.id ? 'active' : ''}`}
                                                    onClick={() => setSelectedChoreId(item.id)}
                                                >
                                                    <strong>{item.title}</strong>
                                                    <small>Weight {item.weight}</small>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="sheet-actions">
                                            <button onClick={() => requestHelp(null)} disabled={!canRequest}>
                                                {credits < HELP_CREDIT_SPEND ? '求援次數不足' : '廣播給全家'}
                                            </button>
                                            <button onClick={closeSwap}>取消</button>
                                        </div>
                                        {candidates.length > 0 && (
                                            <div className="member-targets">
                                                <p className="member-targets-title">指定成員</p>
                                                <div className="member-targets-list">
                                                    {candidates.map((member) => (
                                                        <button key={member.id} className="member-target-btn" onClick={() => requestHelp(member.id)} disabled={!canRequest}>
                                                            {member.emoji} {member.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                )
            }
        </div >
    );
}
