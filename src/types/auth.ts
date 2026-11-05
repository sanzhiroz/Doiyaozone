export interface ServiceUnit {
  code: string;
  name: string;
  shortName: string;
  isCup?: boolean;
}

export const SERVICE_UNITS: ServiceUnit[] = [
  {
    code: '05954',
    name: 'Cup สันโค้ง (ดึงรายงาน)',
    shortName: 'Cup สันโค้ง',
    isCup: true,
  },
  {
    code: '05956',
    name: 'รพ.สต.บ้านป่าตาล',
    shortName: 'รพ.สต.บ้านป่าตาล',
    isCup: false,
  },
  {
    code: '05957',
    name: 'รพ.สต.บ้านกอสะเรียม',
    shortName: 'รพ.สต.บ้านกอสะเรียม',
    isCup: false,
  },
  {
    code: '05958',
    name: 'รพ.สต.บ้านดอยยาว',
    shortName: 'รพ.สต.บ้านดอยยาว',
    isCup: false,
  },
  {
    code: '05959',
    name: 'รพ.สต.บ้านแม่ผาแหน',
    shortName: 'รพ.สต.บ้านแม่ผาแหน',
    isCup: false,
  },
];

export interface RegisteredUser {
  id: string;
  username: string; // Service unit code e.g. '05958'
  password: string; // Service unit code or custom password
  firstName: string;
  lastName: string;
  phone: string;
  serviceUnitCode: string;
  serviceUnitName: string;
  registeredAt: string;
  role?: 'cup' | 'hospital' | 'admin';
}

export interface AuthSession {
  user: RegisteredUser;
  loggedInAt: string;
}
