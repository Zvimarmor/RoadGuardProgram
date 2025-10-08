'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface Shift {
  id: string;
  startTime: string;
  endTime: string;
  postType: string;
  guard: {
    name: string;
    rank?: string;
  } | null;
}

export default function Home() {
  const [currentShifts, setCurrentShifts] = useState<Shift[]>([]);
  const [nextShift, setNextShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentShifts();
    // Refresh every 30 seconds
    const interval = setInterval(fetchCurrentShifts, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchCurrentShifts = async () => {
    try {
      // Get the most recent period
      const periodsRes = await fetch('/api/periods');
      const periods = await periodsRes.json();

      if (periods.length === 0) {
        setLoading(false);
        return;
      }

      const latestPeriod = periods[0];
      const periodRes = await fetch(`/api/periods/${latestPeriod.id}`);
      const periodData = await periodRes.json();

      const now = new Date();
      const shifts = periodData.shifts || [];

      // Find ALL current shifts (all posts currently active)
      const currentShiftsNow = shifts.filter((shift: Shift) => {
        const start = new Date(shift.startTime);
        const end = new Date(shift.endTime);
        return now >= start && now <= end;
      });

      // Find next shift
      const upcoming = shifts
        .filter((shift: Shift) => new Date(shift.startTime) > now)
        .sort((a: Shift, b: Shift) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        )[0];

      setCurrentShifts(currentShiftsNow);
      setNextShift(upcoming || null);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-gray-600 dark:text-gray-400">טוען...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 sm:p-8 lg:p-12">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-3 tracking-tight">עמוד הבית</h1>
          <p className="text-lg text-neutral-600 dark:text-neutral-400">
            {format(new Date(), 'EEEE, d MMMM yyyy', { locale: he })}
          </p>
        </div>

        <div className="grid gap-6">
          {/* Current Shifts - All Posts */}
          <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-950 rounded-3xl shadow-xl shadow-black/5 dark:shadow-black/20 p-12 border border-neutral-200 dark:border-neutral-800">
            <h2 className="text-2xl font-bold mb-8 text-center">השמירות הנוכחיות</h2>
            {currentShifts.length > 0 ? (
              <div className="space-y-6">
                {currentShifts.map((shift) => (
                  <div key={shift.id} className="bg-white dark:bg-neutral-800/50 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-4xl font-black text-neutral-900 dark:text-neutral-100 mb-2">
                          {translatePost(shift.postType)}
                        </div>
                        <div className="text-xl font-medium text-neutral-700 dark:text-neutral-300">
                          {shift.guard?.rank} {shift.guard?.name || 'לא משובץ'}
                        </div>
                      </div>
                      <div className="text-left text-lg font-mono text-neutral-600 dark:text-neutral-400">
                        {format(new Date(shift.startTime), 'HH:mm')} - {format(new Date(shift.endTime), 'HH:mm')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-neutral-500 dark:text-neutral-500 text-xl py-8">
                אין שמירות פעילות כרגע
              </p>
            )}
          </div>

          {/* Next Shift */}
          <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-lg shadow-black/5 dark:shadow-black/20 p-10 border border-neutral-200 dark:border-neutral-800">
            <h2 className="text-xl font-bold mb-8 text-center text-neutral-700 dark:text-neutral-300">השמירה הבאה</h2>
            {nextShift ? (
              <div className="text-center space-y-4">
                <div className="text-6xl font-bold text-neutral-800 dark:text-neutral-200">
                  {translatePost(nextShift.postType)}
                </div>
                <div className="text-xl text-neutral-700 dark:text-neutral-300">
                  {nextShift.guard?.rank} {nextShift.guard?.name}
                </div>
                <div className="text-lg font-mono text-neutral-600 dark:text-neutral-400">
                  {format(new Date(nextShift.startTime), 'HH:mm')} - {format(new Date(nextShift.endTime), 'HH:mm')}
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-500">
                  {format(new Date(nextShift.startTime), 'EEEE, d MMMM', { locale: he })}
                </div>
              </div>
            ) : (
              <p className="text-center text-neutral-500 dark:text-neutral-500 text-lg py-8">
                אין שמירות קרובות
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
