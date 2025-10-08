'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface Guard {
  id: string;
  name: string;
  rank?: string;
}

interface Shift {
  id: string;
  startTime: string;
  endTime: string;
  postType: string;
  shiftType: string;
  isSpecial: boolean;
}

export default function MyShifts() {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [selectedGuardId, setSelectedGuardId] = useState<string>('');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGuards();
  }, []);

  useEffect(() => {
    if (selectedGuardId) {
      fetchGuardShifts(selectedGuardId);
    }
  }, [selectedGuardId]);

  const fetchGuards = async () => {
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

      setGuards(periodData.guards || []);
    } catch (error) {
      console.error('Error fetching guards:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGuardShifts = async (guardId: string) => {
    try {
      const guardRes = await fetch(`/api/guards/${guardId}`);
      const guardData = await guardRes.json();

      const now = new Date();
      const upcomingShifts = (guardData.shifts || [])
        .filter((shift: Shift) => new Date(shift.startTime) >= now)
        .sort((a: Shift, b: Shift) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );

      setShifts(upcomingShifts);
    } catch (error) {
      console.error('Error fetching guard shifts:', error);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-gray-600 dark:text-gray-400">טוען...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">השמירות שלי</h1>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <label className="block text-lg font-medium mb-4">בחר שומר:</label>
          <select
            value={selectedGuardId}
            onChange={(e) => setSelectedGuardId(e.target.value)}
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 outline-none transition-all"
          >
            <option value="">-- בחר שומר --</option>
            {guards.map((guard) => (
              <option key={guard.id} value={guard.id}>
                {guard.rank} {guard.name}
              </option>
            ))}
          </select>
        </div>

        {selectedGuardId && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {shifts.length === 0 ? (
              <div className="p-12 text-center text-gray-500 dark:text-gray-500">
                אין שמירות עתידיות
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead className="bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <tr>
                      <th className="px-3 sm:px-6 py-4 text-right font-semibold whitespace-nowrap">תאריך</th>
                      <th className="px-3 sm:px-6 py-4 text-right font-semibold whitespace-nowrap">שעה</th>
                      <th className="px-3 sm:px-6 py-4 text-right font-semibold whitespace-nowrap">עמדה</th>
                      <th className="px-3 sm:px-6 py-4 text-right font-semibold whitespace-nowrap">סוג</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((shift) => (
                      <tr
                        key={shift.id}
                        className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                      >
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          {format(new Date(shift.startTime), 'EEEE, d MMMM', { locale: he })}
                        </td>
                        <td className="px-3 sm:px-6 py-4 font-mono whitespace-nowrap">
                          {format(new Date(shift.startTime), 'HH:mm')} - {format(new Date(shift.endTime), 'HH:mm')}
                        </td>
                        <td className="px-3 sm:px-6 py-4 font-semibold whitespace-nowrap">
                          {translatePost(shift.postType)}
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
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
        )}
      </div>
    </div>
  );
}
