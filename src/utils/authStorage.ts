import { RegisteredUser, AuthSession, SERVICE_UNITS } from '../types/auth';

const USERS_STORAGE_KEY = 'pao_medical_registered_users_v1';
const SESSION_STORAGE_KEY = 'pao_medical_auth_session_v1';

// Seed initial default accounts for all 5 service units
// Username = รหัสสถานบริการ, Password = รหัสสถานบริการ
const DEFAULT_UNIT_USERS: RegisteredUser[] = SERVICE_UNITS.map((unit) => ({
  id: `default-${unit.code}`,
  username: unit.code,
  password: unit.code,
  firstName: 'เจ้าหน้าที่',
  lastName: unit.shortName,
  phone: '053-000000',
  serviceUnitCode: unit.code,
  serviceUnitName: unit.name,
  registeredAt: '2026-01-01T00:00:00.000Z',
  role: unit.isCup ? 'cup' : 'hospital',
}));

/**
 * Load all registered users from storage, ensuring default accounts exist
 */
export function getRegisteredUsers(): RegisteredUser[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_UNIT_USERS));
      return DEFAULT_UNIT_USERS;
    }
    const parsed: RegisteredUser[] = JSON.parse(raw);
    
    // Ensure default 5 unit accounts exist
    let updated = false;
    const existingUsernames = new Set(parsed.map((u) => u.username));
    const merged = [...parsed];

    DEFAULT_UNIT_USERS.forEach((def) => {
      if (!existingUsernames.has(def.username)) {
        merged.push(def);
        updated = true;
      }
    });

    if (updated) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(merged));
    }

    return merged;
  } catch (err) {
    console.error('Error reading users from storage:', err);
    return DEFAULT_UNIT_USERS;
  }
}

/**
 * Save user list to storage
 */
export function saveRegisteredUsers(users: RegisteredUser[]): void {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Error saving users to storage:', err);
  }
}

/**
 * Authenticate username and password
 * Supports username being service unit code (or registered username/phone)
 * and password being service unit code
 */
export function authenticateUser(
  usernameInput: string,
  passwordInput: string
): { success: boolean; user?: RegisteredUser; error?: string } {
  const users = getRegisteredUsers();
  const cleanUsername = usernameInput.trim();
  const cleanPassword = passwordInput.trim();

  if (!cleanUsername || !cleanPassword) {
    return { success: false, error: 'กรุณากรอกรหัสสถานบริการ (Username) และรหัสผ่าน' };
  }

  // Find user by username, serviceUnitCode, or phone
  const matchedUser = users.find(
    (u) =>
      u.username === cleanUsername ||
      u.serviceUnitCode === cleanUsername ||
      u.phone === cleanUsername
  );

  if (!matchedUser) {
    // If it's one of the known 5 service unit codes, allow standard fallback
    const knownUnit = SERVICE_UNITS.find((u) => u.code === cleanUsername);
    if (knownUnit && cleanPassword === knownUnit.code) {
      const fallbackUser: RegisteredUser = {
        id: `unit-${knownUnit.code}`,
        username: knownUnit.code,
        password: knownUnit.code,
        firstName: 'เจ้าหน้าที่',
        lastName: knownUnit.shortName,
        phone: '',
        serviceUnitCode: knownUnit.code,
        serviceUnitName: knownUnit.name,
        registeredAt: new Date().toISOString(),
        role: knownUnit.isCup ? 'cup' : 'hospital',
      };
      saveRegisteredUsers([...users, fallbackUser]);
      return { success: true, user: fallbackUser };
    }

    return {
      success: false,
      error: 'ไม่พบรหัสสถานบริการในระบบ กรุณาตรวจสอบรหัส 5 หลัก หรือลงทะเบียนบุคลากรใหม่',
    };
  }

  // Password verification:
  // User can log in with their registered password, OR the serviceUnitCode itself (per user requirement)
  const isPasswordValid =
    matchedUser.password === cleanPassword ||
    matchedUser.serviceUnitCode === cleanPassword ||
    cleanPassword === matchedUser.username;

  if (!isPasswordValid) {
    return {
      success: false,
      error: 'รหัสผ่านไม่ถูกต้อง (ค่าเริ่มต้นคือ รหัสสถานบริการ 5 หลัก)',
    };
  }

  return { success: true, user: matchedUser };
}

/**
 * Register a new personnel member
 */
export function registerPersonnel(data: {
  firstName: string;
  lastName: string;
  phone: string;
  serviceUnitCode: string;
  password?: string;
}): { success: boolean; user?: RegisteredUser; error?: string } {
  const cleanFirstName = data.firstName.trim();
  const cleanLastName = data.lastName.trim();
  const cleanPhone = data.phone.trim();
  const cleanUnitCode = data.serviceUnitCode.trim();

  if (!cleanFirstName) {
    return { success: false, error: 'กรุณาระบุชื่อ' };
  }
  if (!cleanLastName) {
    return { success: false, error: 'กรุณาระบุนามสกุล' };
  }
  if (!cleanPhone) {
    return { success: false, error: 'กรุณาระบุเบอร์โทรศัพท์' };
  }
  if (!cleanUnitCode) {
    return { success: false, error: 'กรุณาเลือกรหัสสถานบริการ' };
  }

  const unit = SERVICE_UNITS.find((u) => u.code === cleanUnitCode);
  if (!unit) {
    return { success: false, error: 'รหัสสถานบริการไม่ถูกต้อง กรุณาเลือกจากรายการ 5 แห่ง' };
  }

  const users = getRegisteredUsers();
  
  // Set password: use user provided password or default to service unit code
  const finalPassword = (data.password && data.password.trim()) ? data.password.trim() : cleanUnitCode;

  const newUser: RegisteredUser = {
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    username: cleanUnitCode,
    password: finalPassword,
    firstName: cleanFirstName,
    lastName: cleanLastName,
    phone: cleanPhone,
    serviceUnitCode: cleanUnitCode,
    serviceUnitName: unit.name,
    registeredAt: new Date().toISOString(),
    role: unit.isCup ? 'cup' : 'hospital',
  };

  const updatedList = [newUser, ...users];
  saveRegisteredUsers(updatedList);

  return { success: true, user: newUser };
}

/**
 * Get active session from localStorage
 */
export function getActiveSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch (err) {
    console.error('Error reading session from storage:', err);
    return null;
  }
}

/**
 * Store active session to localStorage
 */
export function setActiveSession(user: RegisteredUser): AuthSession {
  const session: AuthSession = {
    user,
    loggedInAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    console.error('Error saving session to storage:', err);
  }
  return session;
}

/**
 * Clear active session from localStorage
 */
export function clearActiveSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {
    console.error('Error clearing session from storage:', err);
  }
}
