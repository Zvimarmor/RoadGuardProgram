'use client';

import { useState, useEffect } from 'react';

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

  // Fetch current period and guards when modal opens
  useEffect(() => {
    if (activeModal === 'addGuard' || activeModal === 'createActivity') {
      fetchCurrentPeriod();
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
        return { name: line.trim() };
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
        alert('תקופה נוצרה בהצלחה!');
        setActiveModal(null);
        setPeriodName('');
        setStartDate('');
        setEndDate('');
        setGuardsText('');
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
            <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-6 text-center">
              ברירת מחדל: <span className="font-mono">admin / admin</span>
            </p>
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
                    <option value="1.5">1.5 שעות</option>
                    <option value="2">2 שעות</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2.5">שומרים (שורה אחת לכל שומר: שם)</label>
                  <textarea
                    value={guardsText}
                    onChange={(e) => setGuardsText(e.target.value)}
                    rows={8}
                    placeholder="הכנס פה שמות, שם אחד בכל שורה"
                    className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-950 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 focus:border-transparent outline-none font-mono text-sm resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 py-3.5 rounded-xl font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {isCreating ? 'יוצר...' : 'צור תקופה'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="flex-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 py-3.5 rounded-xl font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-700 active:scale-[0.98]"
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
      </div>
    </div>
  );
}
