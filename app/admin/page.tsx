'use client';

import { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { he } from 'date-fns/locale';

interface Guard {
  id: string;
  name: string;
  
  totalHours: number;
  isActive: boolean;
}

interface Period {
  id: string;
  name: string;
  guards: Guard[];
}

interface Activity {
  id: string;
  name: string;
  endTime: Date | null;
  description?: string;
}

interface Shift {
  id: string;
  startTime: string;
  endTime: string;
  postType: string;
  shiftType: string;
  isSpecial: boolean;
  guard: {
    name: string;
    rank?: string;
  } | null;
}

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Period creation state
  const [periodName, setPeriodName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [shiftLength, setShiftLength] = useState('2');
  const [guardsText, setGuardsText] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Current period and guards
  const [currentPeriod, setCurrentPeriod] = useState<Period | null>(null);
  const [allGuards, setAllGuards] = useState<Guard[]>([]);

  // Guard management state
  const [newGuardName, setNewGuardName] = useState('');
  const [selectedGuardId, setSelectedGuardId] = useState('');

  // Activity state
  const [activityName, setActivityName] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [selectedActivityGuards, setSelectedActivityGuards] = useState<string[]>([]);
  const [activeActivities, setActiveActivities] = useState<(Activity & { startTime?: Date })[]>([]);

  // Schedule editing state
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [filterDate, setFilterDate] = useState<string>('');
  const [isSwapping, setIsSwapping] = useState(false);

  // Save guards for next time (localStorage)
  const [saveForNextTime, setSaveForNextTime] = useState(false);

  // Fetch current period and guards when modal opens
  useEffect(() => {
    if (activeModal === 'addGuard' || activeModal === 'createActivity') {
      fetchCurrentPeriod();
    }
    if (activeModal === 'editSchedule') {
      fetchShiftsForEditing();
    }
    if (activeModal === 'createPeriod') {
      // Load saved guards from localStorage
      const savedGuards = localStorage.getItem('savedGuardsList');
      if (savedGuards) {
        setGuardsText(savedGuards);
        setSaveForNextTime(true);
      }
    }
  }, [activeModal]);

  // Fetch activities when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchCurrentPeriod();
    }
  }, [isAuthenticated]);

  const fetchCurrentPeriod = async () => {
    try {
      const res = await fetch('/api/periods');
      const periods = await res.json();
      if (periods.length > 0) {
        const period = periods[0];
        setCurrentPeriod(period);
        setAllGuards(period.guards || []);

        // Fetch active activities for this period
        const activitiesRes = await fetch(`/api/periods/${period.id}/activities`);
        if (activitiesRes.ok) {
          const activities = await activitiesRes.json();
          setActiveActivities(activities.filter((a: Activity & { startTime?: Date }) => a.endTime === null));
        }
      }
    } catch (error) {
      console.error('Error fetching period:', error);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === 'admin') {
      setIsAuthenticated(true);
    } else {
      alert('שם משתמש או סיסמה שגויים');
    }
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    const guards = guardsText
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const parts = line.split(',').map(p => p.trim());
        return {
          name: parts[0],
          team: parts[1] || '' // Team is optional
        };
      });

    const roundToHalfHour = (dateString: string) => {
      const date = new Date(dateString);
      const minutes = date.getMinutes();
      const roundedMinutes = minutes < 30 ? 0 : 30;
      date.setMinutes(roundedMinutes, 0, 0);
      return date.toISOString();
    };

    const payload = {
      name: periodName,
      startDate: roundToHalfHour(startDate),
      endDate: roundToHalfHour(endDate),
      shiftLength: parseFloat(shiftLength),
      guards
    };

    try {
      const res = await fetch('/api/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        // Save guards to localStorage if checkbox is checked
        if (saveForNextTime) {
          localStorage.setItem('savedGuardsList', guardsText);
        } else {
          localStorage.removeItem('savedGuardsList');
        }

        alert('תקופה נוצרה בהצלחה!');
        setActiveModal(null);
        setPeriodName('');
        setStartDate('');
        setEndDate('');
        if (!saveForNextTime) {
          setGuardsText('');
        }
      } else {
        alert('שגיאה ביצירת תקופה');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('שגיאה ביצירת תקופה');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddGuard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPeriod) return;

    try {
      const res = await fetch('/api/guards/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodId: currentPeriod.id,
          name: newGuardName,
        })
      });

      if (res.ok) {
        alert('שומר נוסף בהצלחה!');
        setNewGuardName('');
        fetchCurrentPeriod();
      } else {
        alert('שגיאה בהוספת שומר');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('שגיאה בהוספת שומר');
    }
  };

  const handleRemoveGuard = async () => {
    if (!selectedGuardId) return;

    if (!confirm('האם אתה בטוח שאתה רוצה להסיר שומר זה?')) return;

    try {
      const res = await fetch('/api/guards/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guardId: selectedGuardId })
      });

      if (res.ok) {
        alert('שומר הוסר בהצלחה!');
        setSelectedGuardId('');
        fetchCurrentPeriod();
      } else {
        alert('שגיאה בהסרת שומר');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('שגיאה בהסרת שומר');
    }
  };

  const handleStartActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPeriod || selectedActivityGuards.length === 0) {
      alert('יש לבחור לפחות שומר אחד');
      return;
    }

    try {
      const res = await fetch('/api/activities/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodId: currentPeriod.id,
          name: activityName,
          guardIds: selectedActivityGuards,
          description: activityDescription
        })
      });

      if (res.ok) {
        alert('פעילות התחילה בהצלחה!');
        setActivityName('');
        setActivityDescription('');
        setSelectedActivityGuards([]);
        setActiveModal(null);
        fetchCurrentPeriod();
      } else {
        alert('שגיאה בהפעלת פעילות');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('שגיאה בהפעלת פעילות');
    }
  };

  const handleStopActivity = async (activityId: string) => {
    if (!confirm('האם אתה בטוח שאתה רוצה לעצור את הפעילות?')) return;

    try {
      const res = await fetch('/api/activities/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId })
      });

      if (res.ok) {
        alert('פעילות נעצרה בהצלחה! לוח משמרות רגיל חודש.');
        fetchCurrentPeriod();
      } else {
        alert('שגיאה בעצירת פעילות');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('שגיאה בעצירת פעילות');
    }
  };

  const toggleActivityGuard = (guardId: string) => {
    setSelectedActivityGuards(prev =>
      prev.includes(guardId)
        ? prev.filter(id => id !== guardId)
        : [...prev, guardId]
    );
  };

  const fetchShiftsForEditing = async () => {
    try {
      const periodsRes = await fetch('/api/periods');
      const periods = await periodsRes.json();

      if (periods.length === 0) return;

      const latestPeriod = periods[0];
      const periodRes = await fetch(`/api/periods/${latestPeriod.id}`);
      const periodData = await periodRes.json();

      const now = new Date();
      const upcomingShifts = (periodData.shifts || [])
        .filter((shift: Shift) => new Date(shift.startTime) >= now)
        .sort((a: Shift, b: Shift) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );

      setShifts(upcomingShifts);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    }
  };

  const handleShiftClick = async (shift: Shift) => {
    if (isSwapping) return; // Prevent clicks during swap

    if (!selectedShift) {
      // First click - select this shift
      setSelectedShift(shift);
    } else {
      // Second click - attempt to swap
      const shift1 = selectedShift;
      const shift2 = shift;

      // Clicking same shift - deselect
      if (shift1.id === shift2.id) {
        setSelectedShift(null);
        return;
      }

      // Confirm swap
      const guard1Name = shift1.guard ? shift1.guard.name : 'ללא שומר';
      const guard2Name = shift2.guard ? shift2.guard.name : 'ללא שומר';

      const shift1Time = `${new Date(shift1.startTime).toLocaleString('he-IL', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
      const shift2Time = `${new Date(shift2.startTime).toLocaleString('he-IL', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

      if (!confirm(`האם להחליף בין:\n${guard1Name} - ${translatePost(shift1.postType)} (${shift1Time})\nל-\n${guard2Name} - ${translatePost(shift2.postType)} (${shift2Time})?`)) {
        setSelectedShift(null);
        return;
      }

      setIsSwapping(true);

      try {
        const res = await fetch('/api/shifts/swap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shift1Id: shift1.id,
            shift2Id: shift2.id
          })
        });

        if (res.ok) {
          alert('שומרים הוחלפו בהצלחה!');
          fetchShiftsForEditing(); // Refresh
          setSelectedShift(null);
        } else {
          const data = await res.json();
          alert(`שגיאה: ${data.error}`);
        }
      } catch (error) {
        console.error('Error swapping guards:', error);
        alert('שגיאה בהחלפת שומרים');
      } finally {
        setIsSwapping(false);
      }
    }
  };

  const translatePost = (post: string) => {
    const translations: Record<string, string> = {
      'Gate': 'ש״ג',
      'North': 'צפונית',
      'West': 'מערבית',
      'MorningReadiness': 'כוננות בוקר'
    };
    return translations[post] || post;
  };

  const translateShiftType = (type: string) => {
    return type === 'day' ? 'יום' : 'לילה';
  };


  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl shadow-black/5 dark:shadow-black/20 p-10 border border-neutral-200 dark:border-neutral-800">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">כניסת אדמין</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">הזן פרטי התחברות</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-700 dark:text-neutral-300">
                  שם משתמש
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 focus:border-transparent outline-none"
                  placeholder="הזן שם משתמש"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-700 dark:text-neutral-300">
                  סיסמה
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 focus:border-transparent outline-none"
                  placeholder="הזן סיסמה"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 py-3.5 rounded-xl font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200 active:scale-[0.98] shadow-lg shadow-neutral-900/10 dark:shadow-neutral-100/10"
              >
                התחבר
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 sm:p-8 lg:p-12">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-bold mb-2 tracking-tight">פאנל ניהול</h1>
            <p className="text-neutral-600 dark:text-neutral-400">ניהול תקופות, שומרים ופעילויות</p>
          </div>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-lg"
          >
            התנתק
          </button>
        </div>

        {/* Active Activities Section */}
        {activeActivities.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-2xl p-6 mb-5">
            <h2 className="text-xl font-bold mb-4 text-yellow-900 dark:text-yellow-200">🔴 פעילויות פעילות כעת</h2>
            {activeActivities.map((activity) => (
              <div key={activity.id} className="bg-white dark:bg-neutral-800 rounded-xl p-5 mb-3 last:mb-0">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-bold">{activity.name}</h3>
                    {activity.description && (
                      <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-1">{activity.description}</p>
                    )}
                    {activity.startTime && (
                      <p className="text-sm text-neutral-500 mt-2">
                        התחיל: {new Date(activity.startTime).toLocaleString('he-IL')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleStopActivity(activity.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                  >
                    עצור פעילות
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-5">
          <button
            onClick={() => setActiveModal('createPeriod')}
            className="group bg-white dark:bg-neutral-900 p-8 rounded-2xl shadow-sm shadow-black/5 dark:shadow-black/20 border border-neutral-200 dark:border-neutral-800 hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-black/30 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all text-right"
          >
            <h2 className="text-xl font-bold mb-2 group-hover:text-neutral-900 dark:group-hover:text-neutral-100">צור תקופת שמירה חדשה</h2>
            <p className="text-neutral-600 dark:text-neutral-400 text-[15px] leading-relaxed">
              הגדר תקופה חדשה, הוסף שומרים וצור לוח זמנים אוטומטי
            </p>
          </button>

          <button
            onClick={() => setActiveModal('addGuard')}
            className="group bg-white dark:bg-neutral-900 p-8 rounded-2xl shadow-sm shadow-black/5 dark:shadow-black/20 border border-neutral-200 dark:border-neutral-800 hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-black/30 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all text-right"
          >
            <h2 className="text-xl font-bold mb-2 group-hover:text-neutral-900 dark:group-hover:text-neutral-100">הוסף / הסר שומר</h2>
            <p className="text-neutral-600 dark:text-neutral-400 text-[15px] leading-relaxed">
              ניהול שומרים באמצע תקופה - המערכת תאזן את השמירות אוטומטית
            </p>
          </button>

          <button
            onClick={() => setActiveModal('createActivity')}
            className="group bg-white dark:bg-neutral-900 p-8 rounded-2xl shadow-sm shadow-black/5 dark:shadow-black/20 border border-neutral-200 dark:border-neutral-800 hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-black/30 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all text-right"
          >
            <h2 className="text-xl font-bold mb-2 group-hover:text-neutral-900 dark:group-hover:text-neutral-100">התחל תקופת השהייה (פעילות מיוחדת)</h2>
            <p className="text-neutral-600 dark:text-neutral-400 text-[15px] leading-relaxed">
              הגדר פעילות מיוחדת שמשהה את לוח השמירות הרגיל
            </p>
          </button>

          <button
            onClick={() => setActiveModal('editSchedule')}
            className="group bg-white dark:bg-neutral-900 p-8 rounded-2xl shadow-sm shadow-black/5 dark:shadow-black/20 border border-neutral-200 dark:border-neutral-800 hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-black/30 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all text-right"
          >
            <h2 className="text-xl font-bold mb-2 group-hover:text-neutral-900 dark:group-hover:text-neutral-100">ערוך לוח שמירות</h2>
            <p className="text-neutral-600 dark:text-neutral-400 text-[15px] leading-relaxed">
              החלף שומרים בין משמרות באמצעות לחיצה על משמרת
            </p>
          </button>
        </div>

        {/* Create Period Modal */}
        {activeModal === 'createPeriod' && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setActiveModal(null)}>
            <div className="bg-white dark:bg-neutral-900 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-neutral-200 dark:border-neutral-800" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-3xl font-bold mb-2">צור תקופת שמירה חדשה</h2>
              <p className="text-neutral-600 dark:text-neutral-400 mb-8">מלא את הפרטים ליצירת תקופה אוטומטית</p>
              <form onSubmit={handleCreatePeriod} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold mb-2.5">שם התקופה</label>
                  <input
                    type="text"
                    value={periodName}
                    onChange={(e) => setPeriodName(e.target.value)}
                    placeholder="לדוגמה: שבוע 1 - ינואר 2024"
                    className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-950 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 focus:border-transparent outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2.5">תאריך התחלה</label>
                    <input
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-950 focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2.5">תאריך סיום</label>
                    <input
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-950 focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2.5">אורך משמרת (שעות)</label>
                  <select
                    value={shiftLength}
                    onChange={(e) => setShiftLength(e.target.value)}
                    className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-950 focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 focus:border-transparent outline-none"
                  >
                    <option value="1">1 שעה</option>
                    <option value="1.5">1.5 שעות</option>
                    <option value="2">2 שעות</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2.5">שומרים (שורה אחת לכל שומר: שם, צוות)</label>
                  <textarea
                    value={guardsText}
                    onChange={(e) => setGuardsText(e.target.value)}
                    rows={8}
                    placeholder={`דוגמה:\nדני, אלפא\nמשה, אלפא\nיוסי, ברבו\nאבי, ברבו`}
                    className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-950 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 focus:border-transparent outline-none font-mono text-sm resize-none"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="saveForNextTime"
                      checked={saveForNextTime}
                      onChange={(e) => setSaveForNextTime(e.target.checked)}
                      className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700"
                    />
                    <label htmlFor="saveForNextTime" className="text-sm text-neutral-600 dark:text-neutral-400 cursor-pointer">
                      שמור רשימה זו לפעם הבאה
                    </label>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    הכנס שם וצוות בכל שורה, מופרדים בפסיק. אם אין צוות, רק שם.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 py-3.5 rounded-xl font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
                  >
                    {isCreating && (
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isCreating ? 'יוצר תקופה... (זה יכול לקחת עד 30 שניות)' : 'צור תקופה'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    disabled={isCreating}
                    className="flex-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 py-3.5 rounded-xl font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ביטול
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add/Remove Guard Modal */}
        {activeModal === 'addGuard' && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setActiveModal(null)}>
            <div className="bg-white dark:bg-neutral-900 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-neutral-200 dark:border-neutral-800" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-3xl font-bold mb-2">ניהול שומרים</h2>
              <p className="text-neutral-600 dark:text-neutral-400 mb-8">הוסף או הסר שומרים - השמירות יאוזנו אוטומטית</p>

              {currentPeriod ? (
                <div className="space-y-8">
                  {/* Add Guard Section */}
                  <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6">
                    <h3 className="text-xl font-bold mb-4">הוסף שומר חדש</h3>
                    <form onSubmit={handleAddGuard} className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2">שם השומר</label>
                        <input
                          type="text"
                          value={newGuardName}
                          onChange={(e) => setNewGuardName(e.target.value)}
                          placeholder="שם מלא"
                          className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-950 focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 outline-none"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold"
                      >
                        הוסף שומר
                      </button>
                    </form>
                  </div>

                  {/* Remove Guard Section */}
                  <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6">
                    <h3 className="text-xl font-bold mb-4">הסר שומר</h3>
                    <div className="space-y-4">
                      <select
                        value={selectedGuardId}
                        onChange={(e) => setSelectedGuardId(e.target.value)}
                        className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-950 focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 outline-none"
                      >
                        <option value="">בחר שומר להסרה</option>
                        {allGuards.filter(g => g.isActive).map(guard => (
                          <option key={guard.id} value={guard.id}>
                            {guard.name} ({guard.totalHours.toFixed(1)} שעות)
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleRemoveGuard}
                        disabled={!selectedGuardId}
                        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold"
                      >
                        הסר שומר
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-neutral-500 text-center py-8">אין תקופה פעילה</p>
              )}

              <button
                onClick={() => setActiveModal(null)}
                className="w-full mt-6 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 py-3 rounded-xl font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-700"
              >
                סגור
              </button>
            </div>
          </div>
        )}

        {/* Create Activity Modal */}
        {activeModal === 'createActivity' && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setActiveModal(null)}>
            <div className="bg-white dark:bg-neutral-900 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-neutral-200 dark:border-neutral-800" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-3xl font-bold mb-2">פעילות מיוחדת</h2>
              <p className="text-neutral-600 dark:text-neutral-400 mb-8">הגדר פעילות שמשהה את לוח השמירות הרגיל</p>

              {currentPeriod ? (
                <form onSubmit={handleStartActivity} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold mb-2.5">שם הפעילות</label>
                    <input
                      type="text"
                      value={activityName}
                      onChange={(e) => setActivityName(e.target.value)}
                      placeholder="למשל: אימון מיוחד, תרגיל"
                      className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-950 focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2.5">תיאור (אופציונלי)</label>
                    <textarea
                      value={activityDescription}
                      onChange={(e) => setActivityDescription(e.target.value)}
                      rows={3}
                      placeholder="פרטים נוספים על הפעילות"
                      className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-950 focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2.5">בחר שומרים לפעילות</label>
                    <div className="border border-neutral-300 dark:border-neutral-700 rounded-xl p-4 max-h-64 overflow-y-auto space-y-2">
                      {allGuards.filter(g => g.isActive).map(guard => (
                        <label key={guard.id} className="flex items-center gap-3 p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedActivityGuards.includes(guard.id)}
                            onChange={() => toggleActivityGuard(guard.id)}
                            className="w-4 h-4"
                          />
                          <span>{guard.name}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-sm text-neutral-500 mt-2">{selectedActivityGuards.length} שומרים נבחרו</p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      className="flex-1 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 py-3.5 rounded-xl font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200 shadow-lg"
                    >
                      התחל פעילות
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="flex-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 py-3.5 rounded-xl font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    >
                      ביטול
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-neutral-500 text-center py-8">אין תקופה פעילה</p>
              )}
            </div>
          </div>
        )}

        {/* Edit Schedule Modal */}
        {activeModal === 'editSchedule' && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => { setActiveModal(null); setSelectedShift(null); }}>
            <div className="bg-white dark:bg-neutral-900 rounded-3xl p-8 max-w-7xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-neutral-200 dark:border-neutral-800" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-bold mb-2">ערוך לוח שמירות</h2>
                  <p className="text-neutral-600 dark:text-neutral-400">לחץ על משמרת ואז לחץ על משמרת אחרת כדי להחליף שומרים (גם בזמנים שונים)</p>
                  {selectedShift && (
                    <p className="mt-3 text-lg font-semibold text-blue-600 dark:text-blue-400">
                      נבחר: {selectedShift.guard?.name || 'ללא שומר'} - {translatePost(selectedShift.postType)} - {new Date(selectedShift.startTime).toLocaleString('he-IL', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { setActiveModal(null); setSelectedShift(null); }}
                  className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* Date Filter */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">סנן לפי תאריך:</label>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full max-w-xs px-4 py-3 border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-950 focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 outline-none"
                />
                {filterDate && (
                  <button
                    onClick={() => setFilterDate('')}
                    className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white underline"
                  >
                    נקה סינון
                  </button>
                )}
              </div>

              {/* Shifts Table */}
              <div className="bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                {shifts.length === 0 ? (
                  <div className="p-12 text-center text-neutral-500">אין שמירות להצגה</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                        <tr>
                          <th className="px-4 py-3 text-right font-semibold">תאריך</th>
                          <th className="px-4 py-3 text-right font-semibold">שעה</th>
                          <th className="px-4 py-3 text-right font-semibold">עמדה</th>
                          <th className="px-4 py-3 text-right font-semibold">שומר</th>
                          <th className="px-4 py-3 text-right font-semibold">סוג</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shifts
                          .filter(shift => {
                            if (!filterDate) return true;
                            const shiftDate = new Date(shift.startTime).toISOString().split('T')[0];
                            return shiftDate === filterDate;
                          })
                          .map((shift) => {
                            const isSelected = selectedShift?.id === shift.id;
                            const shiftDate = new Date(shift.startTime);

                            return (
                              <tr
                                key={shift.id}
                                onClick={() => handleShiftClick(shift)}
                                className={`border-b border-neutral-200 dark:border-neutral-700 cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800'
                                    : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                } ${isSwapping ? 'opacity-50 cursor-wait' : ''}`}
                              >
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {shiftDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                                </td>
                                <td className="px-4 py-3 font-mono whitespace-nowrap">
                                  {shiftDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                  {' - '}
                                  {new Date(shift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="px-4 py-3 font-semibold">{translatePost(shift.postType)}</td>
                                <td className="px-4 py-3 font-medium">
                                  {shift.guard ? `${shift.guard.rank || ''} ${shift.guard.name}` : '—'}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-block px-3 py-1 rounded-full text-sm ${
                                    shift.isSpecial
                                      ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                                      : shift.shiftType === 'day'
                                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                                      : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                                  }`}>
                                    {shift.isSpecial ? 'מיוחד' : translateShiftType(shift.shiftType)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-between items-center">
                <button
                  onClick={() => { setActiveModal(null); setSelectedShift(null); }}
                  className="px-6 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-700"
                >
                  סגור
                </button>
                {selectedShift && (
                  <button
                    onClick={() => setSelectedShift(null)}
                    className="px-6 py-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-xl font-semibold hover:bg-red-200 dark:hover:bg-red-800"
                  >
                    בטל בחירה
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
