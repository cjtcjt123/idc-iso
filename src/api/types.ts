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

export interface Floor {
  id: string;
  name?: string;
  code?: string;
  roomId?: string;
  index?: number;
}

export interface Zone {
  id: string;
  name?: string;
  code?: string;
  floorId?: string;
  roomId?: string;
  cols?: number;
  rows?: number;
  coldAisles?: number[];
  hotAisles?: number[];
}

// GET /zones/:id/grid
export interface ZoneGridRack {
  id: string;
  name?: string;
  code?: string;
  kind?: string; // it | ups | ac | pdu | odf | door
  col?: number;
  row?: number;
  uHeight?: number;
  utilization?: number; // 0-1
  deviceCount?: number;
  status?: string; // empty | normal | warning | critical
  customerId?: string | null;
  customerName?: string | null;
  powerFeeds?: string[];
  temperature?: number | null;
  humidity?: number | null;
}
export interface ZoneGridPlaceholder {
  id: string;
  col: number;
  row: number;
  type?: string;
  label?: string;
}
export interface ZoneGrid {
  zone: Zone;
  racks: ZoneGridRack[];
  placeholders: ZoneGridPlaceholder[];
}

export interface Rack {
  id: string;
  code: string;
  name?: string;
  roomId: string;
  roomName?: string;
  zoneId?: string;
  zoneName?: string;
  col?: number;
  row?: number;
  uHeight?: number;
  usedU?: number;
  utilization?: number;
  status?: string;
  kind?: string; // it | ups | ac | pdu | odf | door
  customerId?: string | null;
  customerName?: string | null;
  deviceCount?: number;
  odfCount?: number;
  ownershipMode?: string; // exclusive | shared | free
  powerFeeds?: string[];
}

// 机柜 U 位立面（GET /racks/:id/visual）
/** 后端 /racks/:id/visual 的 units 结构：设备/ODF 都挂在子对象下，没有顶层 id/name */
export interface RackUnitDevice {
  id: string;
  name?: string;
  uHeight?: number;
  uPosition?: number;
  status?: string; // active | inactive | maintenance | offline | reserved
  modelName?: string | null;
  typeName?: string | null;
  categoryName?: string | null;
  customerName?: string | null;
  sn?: string | null;
  powerFeed?: string | null;
}
export interface RackUnitOdf {
  id: string;
  code?: string;
  uStart?: number;
  uHeight?: number;
  portCount?: number;
  portType?: string;
  end?: "A" | "B";
}
export interface RackUnit {
  u: number;
  occupied: boolean;
  device?: RackUnitDevice;
  odf?: RackUnitOdf;
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
  type?: string;        // device type name (resolved)
  typeId?: string;
  typeColor?: string;
  categoryId?: string;
  categoryName?: string;
  modelId?: string;
  modelName?: string;
  uHeight?: number;
  uPosition?: number | null;
  status?: string;
  placement?: "mounted" | "inventory" | "shipped";
  rackId?: string | null;
  rackCode?: string | null;
  rackText?: string;     // 完整位置字符串：机房-楼层-区域-列-行
  uText?: string;        // U 位文本，如 "12U"
  roomId?: string;
  customerId?: string | null;
  customerName?: string | null;
  powerFeed?: string | null;
  createdAt?: string;
}

// ── 设备目录（机柜设备模块用）──
export interface DeviceType {
  id: string;
  name: string;
  color?: string;
}
export interface DeviceCategory {
  id: string;
  name: string;
  parentId?: string | null;
}
export interface DeviceModel {
  id: string;
  name: string;
  typeId?: string;
  categoryId?: string;
  uHeight?: number;
}

// POST /devices 队列条件（机柜设备模块上架表单用）
export interface CreateDevicePayload {
  sn: string;
  modelId?: string;
  categoryId?: string;
  typeId?: string;
  customerId: string;
  roomId: string;
  rackId?: string;
  uHeight?: number;
  uPosition?: number;
  powerFeed?: string;
  primaryIp?: string;
  assetNumber?: string;
  source?: "inventory" | "new";
  sourceInstanceId?: string;
  boardCount?: number;
  portsPerBoard?: number;
}

export interface InventoryItem {
  id: string;
  name?: string;
  sn?: string;
  model?: string;
  brand?: string;
  manufacturer?: string;
  unit?: string;
  categoryId?: string | null;
  categoryName?: string;
  customerId?: string | null;
  customerName?: string;
  status?: string;
  quantity?: number;
  snEnabled?: boolean;
  warningQuantity?: number | null;
  instanceCount?: number;
  spec?: any;
  description?: string;
}

export interface ItemCategory {
  id: string;
  name: string;
  code?: string;
  description?: string;
  parentId?: string | null;
  children?: ItemCategory[];
  _count?: { items?: number; children?: number };
}

export interface Warehouse {
  id: string;
  name: string;
  code?: string;
  roomId?: string | null;
}

export interface Location {
  id: string;
  warehouseId: string;
  warehouse?: { id: string; name: string } | null;
  warehouseName?: string;
  zone?: string | null;
  rack?: string | null;
  uPosition?: string | null;
  bin?: string | null;
  code: string;
  roomId?: string | null;
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
  status?: string; // unused | used | fault | retired | planned
  linkType?: string; // device | odf | external
  deviceId?: string | null;
  devicePortId?: string | null;
  linkedOdfId?: string | null;
  linkedPortNo?: number | null;
  remotePortId?: string | null;
  customerName?: string | null;
  note?: string | null;
  externalCarrier?: string | null;
  externalCircuitNo?: string | null;
  externalPeerSite?: string | null;
}

/** 跳线（jumper）：本端 ODF 母头 ↔ 对端（设备 / 另一 ODF / 出局） */
export interface OdfLink {
  id: string;
  fromOdfId: string;
  fromPort?: number;
  toOdfId?: string | null;
  toPort?: number | null;
  toDeviceId?: string | null;
  toDeviceSn?: string | null;
  linkType?: string; // device | odf | external
  label?: string;
  cableType?: string;
  length?: number;
  note?: string;
  customerId?: string | null;
  customerName?: string | null;
  externalInfo?: string | null;
  ticketNo?: string | null;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** 端到端光路追踪节点 */
export interface OdfTraceNode {
  kind?: string; // od-f-local | odf-fixed | device | external | fault
  title?: string;
  sub?: string;
}

export interface OdfPortTrace {
  route?: string;
  nodes?: OdfTraceNode[];
}

/** ODF 端口历史事件 */
export interface OdfPortHistory {
  id: string;
  eventType?: string; // connect | disconnect | status_change | note
  note?: string;
  operatorName?: string;
  createdAt?: string;
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

// GET /inventory/instances/:id/history（SN 轨迹 / 台账流水）
export interface ItemInstanceHistory {
  id: string;
  operationType: string; // PURCHASE/RECEIVE/TRANSFER_IN/CHECKOUT/SHIP/RETURN/REPAIR/SCRAP/ADJUST ...
  quantity?: number; // 带符号变动量（+入库 / −出库）
  qtyAfter?: number;
  statusBefore?: string | null;
  statusAfter?: string | null;
  batchNo?: string | null;
  snList?: string[];
  reason?: string | null;
  referenceNo?: string | null;
  note?: string | null;
  destination?: string | null;
  operatedAt?: string;
  operator?: { id: string; displayName?: string; username?: string } | null;
  customer?: { id: string; name: string } | null;
  warehouse?: { id: string; name: string } | null;
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

// GET /inventory/operations（统一操作记录 feed，cursor 分页）
export interface OperationFeedItem {
  uid: string;
  kind: string; // mat / dev-in / dev-out / dev-mount / dev-dismount / audit
  occurredAt: string;
  payload: any; // 按 kind 不同而不同
}
export interface OperationFeed {
  data: OperationFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ── 盘点（GET /inventory/counts）──
export interface CountItemVM {
  id: string;
  taskId?: string;
  entityType?: string;
  entityId?: string;
  name?: string;
  sn?: string;
  groupKey?: string;
  groupType?: string;
  position?: string;
  bookQty?: number | null;
  actualQty?: number | null;
  result?: "pending" | "found" | "missing" | "misplaced" | "unexpected";
  countedAt?: string | null;
  countedBy?: string | null;
  scannedRack?: string | null;
  byRack?: boolean;
  note?: string | null;
}
export interface CountTaskVM {
  id: string;
  roomId?: string;
  kind: "device" | "stock";
  customerId?: string;
  customerName?: string;
  scopeType?: string;
  scopeId?: string;
  scopeLabel?: string;
  status: "draft" | "counting" | "done";
  operatorName?: string;
  createdAt?: string;
  finishedAt?: string | null;
  total?: number;
  counted?: number;
  found?: number;
  missing?: number;
  misplaced?: number;
  unexpected?: number;
  items?: CountItemVM[];
}
export interface CountReportVM {
  task: CountTaskVM;
  summary: {
    total?: number;
    counted?: number;
    found?: number;
    missing?: number;
    misplaced?: number;
    unexpected?: number;
    byRack?: number;
  };
  todo: CountItemVM[];
}

// ── 网络管理（GET /networks/subnets, GET /networks/subnets/:id/addresses）──
export interface Subnet {
  id: string;
  name?: string;
  cidr?: string; // e.g. "10.0.0.0/24"
  vlan?: number | string;
  gateway?: string;
  roomId?: string;
  status?: string;
  capacity?: number;
  used?: number;
  free?: number;
}
export interface IpAddress {
  id: string;
  subnetId?: string;
  ip?: string;
  status?: string; // assigned | reserved | free
  deviceId?: string | null;
  deviceName?: string | null;
  customerName?: string | null;
  note?: string;
}

// ── 导入导出（POST /import-export/devices/import 返回摘要）──
export interface ImportSummary {
  inserted?: number;
  updated?: number;
  failed?: number;
  errors?: { row?: number; reason?: string }[];
}

// ── 首页仪表盘聚合（GET /stats/dashboard?roomId，对齐小程序 DashboardStats）──
export interface CustomerDeviceStat {
  customerId: string;
  name: string;
  total: number;
  server: number;
  network: number;
  other: number;
}
export interface CustomerRackStat {
  customerId: string;
  name: string;
  usedRacks: number;
}
export interface CustomerInventoryStat {
  customerId: string;
  name: string;
  quantity: number;
}
export interface MonthlyLifecycle {
  key: string; // YYYY-MM
  label: string; // 如 "8月"
  mount: number;
  dismount: number;
}
export interface DashboardStats {
  devices: {
    total: number;
    server: number;
    network: number;
    other: number;
    byCustomer: CustomerDeviceStat[];
  };
  racks: {
    total: number;
    used: number;
    unused: number;
    uUsed: number;
    uTotal: number;
    utilization: number; // 0-100
    byCustomer: CustomerRackStat[];
  };
  customers: {
    total: number;
    individual: number;
    retail: number;
  };
  inventory: {
    total: number;
    byCustomer: CustomerInventoryStat[];
  };
  lifecycle: MonthlyLifecycle[];
}

// ── 客户授权（GET /customer-authorizations，机房隔离；对齐小程序 AUTH_TYPES 9 类）──
export const AUTH_TYPES: string[] = [
  "设备上架",
  "设备下架",
  "设备维护",
  "设备巡检",
  "人员进出机房",
  "设备出入库",
  "施工布线",
  "应急操作",
  "其他",
];
export const AUTH_SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "email", label: "邮件" },
  { value: "paper", label: "纸质函" },
  { value: "other", label: "其他" },
];
export const AUTH_SOURCE_LABELS: Record<string, string> = {
  email: "邮件",
  paper: "纸质函",
  other: "其他",
};

export interface CustomerAuthorization {
  id: string;
  tenantId?: string;
  roomId?: string;
  customerId: string;
  customer?: { id: string; name: string } | null;
  authDate: string | null;
  authType: string;
  content: string;
  source?: string;
  operator?: string | null;
  remark?: string | null;
  createdAt?: string;
}

export type CreateCustomerAuthorizationPayload = {
  customerId: string;
  authDate: string;
  authType: string;
  content: string;
  source?: string;
  operator?: string;
  remark?: string;
};

// ── 枚举中心（GET /enums，RBAC enum:*；对齐小程序 enum-center）──
export interface EnumOption {
  value: string;
  label: string;
  color?: string | null;
  sortOrder?: number;
}
export interface EnumDef {
  id: string;
  tenantId?: string;
  code: string;
  name: string;
  description?: string | null;
  options: EnumOption[];
  isSystem: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ── 用户与权限管理（GET /users, GET /roles；仅超管；对齐小程序 admin/users）──
export interface AdminUser {
  id: string;
  username: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  isActive?: boolean;
  isStaff?: boolean;
  isSuperuser?: boolean;
  userGroup?: "ops" | "customer" | null;
  customerId?: string | null;
  customerName?: string | null;
  roleId?: string | null;
  roleName?: string | null;
  roomIds?: string[];
}
export interface RoleDef {
  id: string;
  name: string;
  code?: string;
  description?: string | null;
  permissions: string[];
}

/** 数据备份记录（对齐 miniprogram/types Backup） */
export interface Backup {
  id: string;
  fileName: string;
  fileSize: number;
  path: string;
  status: string; // pending | done | failed
  error?: string | null;
  createdAt: string;
}
