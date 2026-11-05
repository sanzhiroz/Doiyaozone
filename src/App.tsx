import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { GoogleSheetView } from './components/GoogleSheetView';
import { DoctorHoursSummary } from './components/DoctorHoursSummary';
import { MonthlyReportPDFView } from './components/MonthlyReportPDFView';
import { DoctorAttendanceSheetView } from './components/DoctorAttendanceSheetView';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { CardListView } from './components/CardListView';
import { RecordFormModal } from './components/RecordFormModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { ToastNotification } from './components/ToastNotification';
import {
  MedicalLogEntry,
  NotificationState,
  HOSPITALS,
  HospitalName,
  getServiceUnitForHospital,
} from './types';
import { RegisteredUser } from './types/auth';
import { LoginPage } from './components/LoginPage';
import { getActiveSession, clearActiveSession } from './utils/authStorage';
import {
  loadStoredRecords,
  saveRecordsToStorage,
  mergeMedicalRecords,
  enrichMedicalRecord,
  generateGoogleSheetsTSV,
  downloadCSV,
  downloadBackupJSON,
  formatThaiDate,
} from './utils/storage';
import {
  subscribeFirestoreMedicalLogs,
  upsertFirestoreMedicalLog,
  removeFirestoreMedicalLog,
} from './firebase';

export default function App() {
  const [currentUser, setCurrentUser] = useState<RegisteredUser | null>(() => {
    const session = getActiveSession();
    return session?.user || null;
  });

  const [records, setRecords] = useState<MedicalLogEntry[]>(() => loadStoredRecords());
  const [activeTab, setActiveTab] = useState<
    'sheet' | 'hours' | 'pdf' | 'attendance' | 'charts' | 'cards'
  >('sheet');

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MedicalLogEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<MedicalLogEntry | null>(null);

  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(false);
  const [connectedClients, setConnectedClients] = useState<number>(1);

  const wsRef = useRef<WebSocket | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const deletedIdsRef = useRef<Set<string>>(new Set());

  const [notification, setNotification] = useState<NotificationState>({
    show: false,
    type: 'info',
    title: '',
    message: '',
  });

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification((prev) => ({ ...prev, show: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification.show]);

  // Apply incoming records additively (never reset or wipe unless explicitly deleted)
  const applyMergedRecords = useCallback((incomingList: MedicalLogEntry[]) => {
    setRecords((prev) => {
      const merged = mergeMedicalRecords(prev, incomingList, deletedIdsRef.current);
      if (merged.length > 0) {
        saveRecordsToStorage(merged);
      }
      return merged;
    });
  }, []);

  // Replace state when server sends authoritative list after an explicit delete or full sync
  const applyServerRecords = useCallback((serverList: MedicalLogEntry[]) => {
    setRecords((prev) => {
      // Combine with any local items not explicitly deleted
      const merged = mergeMedicalRecords(prev, serverList, deletedIdsRef.current);
      saveRecordsToStorage(merged, true);
      return merged;
    });
  }, []);

  // 1. Initial REST sync + WebSocket real-time connection + BroadcastChannel + Firestore
  useEffect(() => {
    const localInitial = loadStoredRecords();

    // Sync local records to server and pull all shared records across all machines/accounts
    async function syncWithServer() {
      try {
        const res = await fetch('/api/records/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records: localInitial }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.records)) {
            applyMergedRecords(data.records);
          }
          if (typeof data.connectedClients === 'number') {
            setConnectedClients(data.connectedClients);
          }
          setIsRealtimeConnected(true);
        }
      } catch (err) {
        console.error('Initial server sync fallback to local storage:', err);
      }
    }

    syncWithServer();

    // Setup BroadcastChannel for instant cross-tab sync
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('node_doi_yao_realtime_sync');
      broadcastChannelRef.current = bc;
      bc.onmessage = (ev) => {
        const msg = ev.data;
        if (!msg) return;
        if (msg.type === 'record:upsert' && msg.record) {
          deletedIdsRef.current.delete(msg.record.id);
          applyMergedRecords([msg.record]);
        } else if (msg.type === 'record:delete' && msg.id) {
          const targetId = String(msg.id);
          deletedIdsRef.current.add(targetId);
          setRecords((prev) => {
            const next = prev.filter((r) => r.id !== targetId);
            saveRecordsToStorage(next, true);
            return next;
          });
        } else if (msg.type === 'records:sync' && Array.isArray(msg.records)) {
          applyMergedRecords(msg.records);
        }
      };
    }

    // Setup WebSocket connection with automatic reconnect
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    function connectWebSocket() {
      if (isUnmounted) return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) return;
          setIsRealtimeConnected(true);
          const currentLocal = loadStoredRecords();
          if (currentLocal.length > 0) {
            ws.send(
              JSON.stringify({
                type: 'records:sync',
                records: currentLocal,
              })
            );
          }
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(String(event.data));
            if (typeof msg.connectedClients === 'number') {
              setConnectedClients(msg.connectedClients);
            }

            if (msg.type === 'records:init' || msg.type === 'records:sync') {
              if (Array.isArray(msg.records)) {
                applyMergedRecords(msg.records);
              }
            } else if (msg.type === 'record:upsert' && msg.record) {
              deletedIdsRef.current.delete(msg.record.id);
              if (Array.isArray(msg.records)) {
                applyMergedRecords(msg.records);
              } else {
                applyMergedRecords([msg.record]);
              }
            } else if (msg.type === 'record:delete' && msg.id) {
              const targetId = String(msg.id);
              deletedIdsRef.current.add(targetId);
              setRecords((prev) => {
                const next = prev.filter((r) => r.id !== targetId);
                saveRecordsToStorage(next, true);
                return next;
              });
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          setIsRealtimeConnected(false);
          reconnectTimer = setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (err) {
        console.error('WebSocket connection error:', err);
        reconnectTimer = setTimeout(connectWebSocket, 3000);
      }
    }

    connectWebSocket();

    // Also subscribe to Cloud Firestore when authenticated
    const unsubscribeFirestore = subscribeFirestoreMedicalLogs((firestoreEntries) => {
      if (firestoreEntries.length > 0) {
        applyMergedRecords(firestoreEntries);
      }
    });

    // Listen to storage events across tabs
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key && e.newValue) {
        const stored = loadStoredRecords();
        if (stored.length > 0) {
          applyMergedRecords(stored);
        }
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
      unsubscribeFirestore();
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [applyMergedRecords, applyServerRecords]);

  // Determine default hospital based on logged-in user's service unit
  const defaultUserHospital: HospitalName = React.useMemo(() => {
    if (!currentUser) return HOSPITALS[0];
    const matched = HOSPITALS.find(
      (h) => h === currentUser.serviceUnitName || currentUser.serviceUnitName?.includes(h)
    );
    return matched || HOSPITALS[0];
  }, [currentUser]);

  // Save handler for Add / Edit
  const handleSaveRecord = async (
    formData: Omit<MedicalLogEntry, 'id' | 'createdAt' | 'updatedAt'>,
    editId?: string
  ) => {
    const nowIso = new Date().toISOString();
    const unitInfo = getServiceUnitForHospital(formData.hospital);

    let savedEntry: MedicalLogEntry;
    const isNew = !editId;

    if (editId) {
      const existing = records.find((r) => r.id === editId);
      savedEntry = enrichMedicalRecord({
        ...(existing || {}),
        ...formData,
        id: editId,
        serviceUnitCode: unitInfo.code,
        serviceUnitName: unitInfo.name,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
      });
    } else {
      savedEntry = enrichMedicalRecord({
        ...formData,
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        serviceUnitCode: unitInfo.code,
        serviceUnitName: unitInfo.name,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    deletedIdsRef.current.delete(savedEntry.id);

    // 1. Optimistic local update + permanent localStorage backup
    setRecords((prev) => {
      const merged = mergeMedicalRecords(prev, [savedEntry], deletedIdsRef.current);
      saveRecordsToStorage(merged);
      return merged;
    });

    setIsFormModalOpen(false);
    setEditingEntry(null);

    // 2. Broadcast to same-browser tabs immediately
    broadcastChannelRef.current?.postMessage({
      type: 'record:upsert',
      record: savedEntry,
    });

    // 3. Send via WebSocket if open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'record:upsert',
          record: savedEntry,
        })
      );
    }

    // 4. Persist to shared backend REST API
    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record: savedEntry }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.records)) {
          applyMergedRecords(data.records);
        }
      }
    } catch (err) {
      console.error('Error syncing record to server API:', err);
    }

    // 5. Sync to Firestore if Firebase Auth is active
    try {
      await upsertFirestoreMedicalLog(savedEntry, isNew);
    } catch (err) {
      console.error('Firestore upsert error:', err);
    }

    setNotification({
      show: true,
      type: 'success',
      title: editId ? 'แก้ไขและซิงค์ข้อมูลสำเร็จ' : 'บันทึกและซิงค์ข้อมูลสำเร็จ',
      message: `${
        editId ? 'อัปเดต' : 'บันทึก'
      }ข้อมูลวันที่ ${formatThaiDate(
        formData.date,
        'short'
      )} ณ ${formData.hospital} (${unitInfo.code}) แสดงผลรวมทุกเครื่องแบบ Real-time เรียบร้อยแล้ว`,
    });
  };

  // Delete handler
  const handleConfirmDelete = async (id: string) => {
    const target = records.find((r) => r.id === id);
    deletedIdsRef.current.add(id);

    const updatedList = records.filter((r) => r.id !== id);
    setRecords(updatedList);
    saveRecordsToStorage(updatedList, true);
    setDeletingEntry(null);

    broadcastChannelRef.current?.postMessage({
      type: 'record:delete',
      id,
    });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'record:delete',
          id,
        })
      );
    }

    try {
      await fetch(`/api/records/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Error deleting record from server API:', err);
    }

    try {
      await removeFirestoreMedicalLog(id);
    } catch (err) {
      console.error('Firestore delete error:', err);
    }

    setNotification({
      show: true,
      type: 'warning',
      title: 'ลบข้อมูลสำเร็จ',
      message: target
        ? `ลบรายการวันที่ ${formatThaiDate(target.date, 'short')} (${target.hospital}) เรียบร้อยแล้ว`
        : 'ลบรายการออกจากระบบเรียบร้อยแล้ว',
    });
  };

  // Copy TSV to clipboard for Google Sheets
  const handleCopyTSV = async () => {
    try {
      const tsvText = generateGoogleSheetsTSV(records);
      await navigator.clipboard.writeText(tsvText);
      setNotification({
        show: true,
        type: 'success',
        title: 'คัดลอกข้อมูลตารางสำเร็จ!',
        message:
          'คัดลอกข้อมูลในรูปแบบ Google Sheet เรียบร้อยแล้ว สามารถกด Ctrl+V เพื่อวางใน Google Sheets ได้ทันที',
      });
    } catch {
      setNotification({
        show: true,
        type: 'info',
        title: 'กำลังดาวน์โหลดข้อมูลแทนการคัดลอก',
        message: 'ระบบกำลังส่งออกไฟล์ CSV ให้แทนเนื่องจากสิทธิ์คลิปบอร์ดของเบราว์เซอร์',
      });
      downloadCSV(records);
    }
  };

  // Download CSV
  const handleExportCSV = () => {
    downloadCSV(records);
    setNotification({
      show: true,
      type: 'info',
      title: 'ส่งออกไฟล์ CSV เรียบร้อยแล้ว',
      message:
        'ไฟล์ CSV รองรับภาษาไทยสมบูรณ์ สามารถเปิดด้วย Google Sheets หรือ Microsoft Excel ได้ทันที',
    });
  };

  // Download permanent JSON backup
  const handleBackupJSON = () => {
    downloadBackupJSON(records);
    setNotification({
      show: true,
      type: 'success',
      title: 'สำรองข้อมูลถาวรเรียบร้อย',
      message: `ดาวน์โหลดไฟล์สำรองข้อมูล (${records.length} แถว) สำหรับจัดเก็บไว้ในคอมพิวเตอร์อย่างถาวรแล้ว`,
    });
  };

  // Handle user logout
  const handleLogout = () => {
    clearActiveSession();
    setCurrentUser(null);
    setNotification({
      show: true,
      type: 'info',
      title: 'ออกจากระบบเรียบร้อย',
      message: 'ออกจากระบบสำเร็จ ข้อมูลที่บันทึกไว้ทั้งหมดยังคงอยู่ถาวร สามารถเข้าสู่ระบบใหม่ได้ตลอดเวลา',
    });
  };

  // If not logged in, display the Login Screen
  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setNotification({
            show: true,
            type: 'success',
            title: 'ยินดีต้อนรับเข้าสู่ระบบ',
            message: `${user.serviceUnitName} (${user.serviceUnitCode}) - แสดงข้อมูลรวมทุกสถานบริการแบบ Real-time`,
          });
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-['Prompt',sans-serif]">
      {/* Top Header & Navigation */}
      <Header
        records={records}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenAddModal={() => {
          setEditingEntry(null);
          setIsFormModalOpen(true);
        }}
        onExportCSV={handleExportCSV}
        onCopyTSV={handleCopyTSV}
        onBackupJSON={handleBackupJSON}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'sheet' && (
          <GoogleSheetView
            records={records}
            isRealtimeConnected={isRealtimeConnected}
            connectedClients={connectedClients}
            onOpenAddModal={() => {
              setEditingEntry(null);
              setIsFormModalOpen(true);
            }}
            onEditEntry={(entry) => {
              setEditingEntry(entry);
              setIsFormModalOpen(true);
            }}
            onDeleteEntry={(entry) => {
              setDeletingEntry(entry);
            }}
            onExportCSV={handleExportCSV}
            onCopyTSV={handleCopyTSV}
            onOpenPDFReport={() => setActiveTab('pdf')}
          />
        )}

        {activeTab === 'hours' && (
          <DoctorHoursSummary
            records={records}
            onOpenAddModal={() => {
              setEditingEntry(null);
              setIsFormModalOpen(true);
            }}
          />
        )}

        {activeTab === 'pdf' && <MonthlyReportPDFView records={records} />}

        {activeTab === 'attendance' && <DoctorAttendanceSheetView records={records} />}

        {activeTab === 'charts' && <AnalyticsCharts records={records} />}

        {activeTab === 'cards' && (
          <CardListView
            records={records}
            onOpenAddModal={() => {
              setEditingEntry(null);
              setIsFormModalOpen(true);
            }}
            onEditEntry={(entry) => {
              setEditingEntry(entry);
              setIsFormModalOpen(true);
            }}
            onDeleteEntry={(entry) => {
              setDeletingEntry(entry);
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="no-print bg-white border-t border-slate-200 mt-auto py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            <span className="font-medium text-slate-800">
              ระบบบันทึกการปฏิบัติงานของแพทย์ Node ดอยยาว (ซิงค์ข้อมูลรวมทุกสถานบริการแบบ Real-time)
            </span>
          </div>
          <div className="text-slate-600">
            ในสังกัด องค์การบริหารส่วนจังหวัดเชียงใหม่ (อบจ.เชียงใหม่)
          </div>
        </div>
      </footer>

      {/* Add / Edit Modal */}
      <RecordFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingEntry(null);
        }}
        onSave={handleSaveRecord}
        editingEntry={editingEntry}
        defaultHospital={defaultUserHospital}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingEntry)}
        entry={deletingEntry}
        onClose={() => setDeletingEntry(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Alert / Toast Notification */}
      <ToastNotification
        notification={notification}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />
    </div>
  );
}
