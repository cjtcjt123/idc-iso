// 后端契约（来源：NestJS /api/v1）。仅定义前端用到的字段，按需扩展。

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  isStaff: boolean;
  isSuperuser: boolean;
  tenantId?: string;
  role?: string;
  customerId?: string | null;
  userGroup?: "ops" | "customer";
  roleId?: string;
  roleName?: string;
  permissions?: string[];
}

export interface LoginResponse {
  accessToken: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Room {
  id: string;
  name: string;
  code?: string;
  status?: string;
  address?: string;
  createdAt?: string;
}

export interface Rack {
  id: string;
  code: string;
  roomId: string;
  zoneId?: string;
  col?: number;
  row?: number;
  uHeight?: number;
  utilization?: number;
  status?: string;
  customerId?: string | null;
}

// 机柜 U 位立面（GET /racks/:id/visual）
export interface RackUnit {
  u: number;
  occupied: boolean;
  id?: string;
  name?: string;
  uHeight?: number;
  uPosition?: number;
  status?: string; // active | inactive | maintenance | offline | reserved
  modelName?: string | null;
  typeName?: string | null;
  categoryName?: string | null;
  serialNumber?: string | null;
  powerFeed?: string | null;
}

export interface RackPdu {
  id: string;
  position?: string;
  startAmpere?: number;
  outputType?: string;
  phaseType?: string;
  hasMeter?: boolean;
  feeds?: string[];
}

export interface RackVisual {
  rack: {
    id: string;
    name: string;
    uHeight: number;
    uUnits: string[];
    customerId?: string | null;
    customer?: { id: string; name: string } | null;
  };
  units: RackUnit[];
  odfModules?: any[];
  pdus?: RackPdu[];
}

export interface Device {
  id: string;
  sn?: string;
  name?: string;
  model?: string;
  brand?: string;
  type?: string;
  status?: string;
  placement?: "mounted" | "inventory" | "shipped";
  rackId?: string | null;
  uPosition?: number | null;
  roomId?: string;
  customerId?: string | null;
  createdAt?: string;
}

export interface InventoryItem {
  id: string;
  name?: string;
  sn?: string;
  model?: string;
  brand?: string;
  categoryId?: string | null;
  customerId?: string | null;
  status?: string;
  quantity?: number;
}

export interface OdfModule {
  id: string;
  name?: string;
  code?: string;
  rackId: string;
  roomId: string;
  portCount?: number;
  customerId?: string | null;
}

export interface OdfPort {
  id: string;
  portNo?: number;
  portName?: string;
  moduleId?: string;
  status?: string; // idle / connected / fault ...
  linkType?: string; // downlink / uplink
  deviceId?: string | null;
  remotePortId?: string | null;
}

export interface InventoryInstance {
  id: string;
  name?: string;
  sn?: string;
  model?: string;
  brand?: string;
  categoryName?: string;
  status?: string; // in_stock / in_use / in_repair / scrapped / reserved
  quantity?: number;
  warehouseName?: string;
  customerName?: string;
}

export interface Customer {
  id: string;
  name: string;
  code?: string;
  contact?: string;
  phone?: string;
  email?: string;
  type?: string;
  roomId?: string;
  status?: string;
}

export interface Accessory {
  id: string;
  name: string;
  category?: string;
  model?: string;
  serialNumber?: string;
  status?: string; // in_stock | in_use | scrapped
  quantity?: number;
  unit?: string;
  customerId?: string | null;
  deviceId?: string | null; // 已应用到该设备
  slot?: string;
  note?: string;
}

export interface CreateCustomerInput {
  name: string;
  code?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  remark?: string;
}

export interface MountDeviceInput {
  rackId: string;
  uPosition: number;
}

export interface DismountDeviceInput {
  reason: string;
  destination: "inventory" | "shipped";
}

export interface StockMovementInput {
  quantity?: number;
  reason?: string;
}

export interface OperationRecord {
  id: string;
  kind?: string; // mat / dev-in / dev-out / dev-mount / dev-dismount / audit
  summary?: string;
  operator?: string;
  createdAt?: string;
}

export interface AuditLog {
  id: string;
  action?: string;
  resourceName?: string;
  resourceId?: string;
  operator?: string;
  ipAddress?: string;
  createdAt?: string;
}
