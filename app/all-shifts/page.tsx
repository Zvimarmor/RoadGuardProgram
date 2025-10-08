'use client';

import { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { he } from 'date-fns/locale';

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

export default function AllShifts() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [filteredShifts, setFilteredShifts] = useState<Shift[]>([]);
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterPost, setFilterPost] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllShifts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [shifts, filterDate, filterPost]);

  const fetchAllShifts = async () => {
    try {
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
      const upcomingShifts = (periodData.shifts || [])
        .filter((shift: Shift) => new Date(shift.startTime) >= now)
        .sort((a: Shift, b: Shift) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );

      setShifts(upcomingShifts);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...shifts];

    if (filterDate) {
      const selectedDate = new Date(filterDate);
      const dayStart = startOfDay(selectedDate);
      const dayEnd = endOfDay(selectedDate);

      filtered = filtered.filter((shift) => {
        const shiftStart = new Date(shift.startTime);
        return shiftStart >= dayStart && shiftStart <= dayEnd;
      });
    }

    if (filterPost) {
      filtered = filtered.filter((shift) => shift.postType === filterPost);
    }

    setFilteredShifts(filtered);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-gray-600 dark:text-gray-400">טוען...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">כל השמירות</h1>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">סנן לפי תאריך:</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">סנן לפי עמדה:</label>
              <select
                value={filterPost}
                onChange={(e) => setFilterPost(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 outline-none"
              >
                <option value="">הכל</option>
                <option value="Gate">ש״ג</option>
                <option value="North">צפונית</option>
                <option value="West">מערבית</option>
                <option value="MorningReadiness">כוננות בוקר</option>
              </select>
            </div>
          </div>
          {(filterDate || filterPost) && (
            <button
              onClick={() => {
                setFilterDate('');
                setFilterPost('');
              }}
              className="mt-4 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white underline"
            >
              נקה סינונים
            </button>
          )}
        </div>

        {/* Shifts Table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {filteredShifts.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-500">
              אין שמירות להצגה
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="px-6 py-4 text-right font-semibold">שם השומר</th>
                    <th className="px-6 py-4 text-right font-semibold">תאריך</th>
                    <th className="px-6 py-4 text-right font-semibold">שעת התחלה</th>
                    <th className="px-6 py-4 text-right font-semibold">שעת סיום</th>
                    <th className="px-6 py-4 text-right font-semibold">עמדה</th>
                    <th className="px-6 py-4 text-right font-semibold">סוג</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShifts.map((shift, index) => (
                    <tr
                      key={shift.id}
                      className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${
                        index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-850'
                      }`}
                    >
                      <td className="px-6 py-4 font-medium">
                        {shift.guard ? `${shift.guard.rank || ''} ${shift.guard.name}` : '—'}
                      </td>
                      <td className="px-6 py-4">
                        {format(new Date(shift.startTime), 'd MMMM', { locale: he })}
                      </td>
                      <td className="px-6 py-4 font-mono">
                        {format(new Date(shift.startTime), 'HH:mm')}
                      </td>
                      <td className="px-6 py-4 font-mono">
                        {format(new Date(shift.endTime), 'HH:mm')}
                      </td>
                      <td className="px-6 py-4 font-semibold">
                        {translatePost(shift.postType)}
                      </td>
                      <td className="px-6 py-4">
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-gray-600 dark:text-gray-400 text-sm">
          מציג {filteredShifts.length} מתוך {shifts.length} שמירות
        </div>
      </div>
    </div>
  );
}
