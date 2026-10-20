import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, Laptop, Ticket, Wrench, Calendar, 
  Package, Key, Users, FileBarChart, History, Settings, 
  Menu, X, Bell, LogOut, User, Lock, ChevronRight, ChevronDown,
  Database, Shield, Network, Printer, Folder, Wifi, Globe, Server, Radio, Calculator,
  Building2, Boxes, TrendingDown, BookOpen, Layers
} from 'lucide-react';

export default function Layout() {
  const { user, logout, hasPermission, notifications, unreadNotificationsCount, markNotificationAsRead } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [dropdowns, setDropdowns] = useState({
    'PPE Management': true,
    'IT Operations Hub': false,
    'Administration': false
  });
  
  const location = useLocation();
  const navigate = useNavigate();

  // Navigation config with permissions
  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, perm: 'dashboard.view' },
    
    // ==========================================
    // PPE MODULES
    // ==========================================
    {
      isDropdown: true,
      name: 'PPE Management',
      icon: Building2,
      items: [
        { name: 'PPE Dashboard', path: '/ppe', icon: LayoutDashboard, perm: 'ppe.assets.view' },
        { name: 'Capital Assets', path: '/ppe/assets', icon: Building2, perm: 'ppe.assets.view' },
        { name: 'Depreciation & Accounting', path: '/ppe/accounting', icon: BookOpen, perm: 'ppe.accounting.view' },
        { name: 'Returnable Containers', path: '/ppe/containers', icon: Boxes, perm: 'ppe.containers.view' },
        { name: 'PPE Reports & Labels', path: '/ppe/reports', icon: FileBarChart, perm: 'ppe.reports.view' },
      ]
    },

    // ==========================================
    // ITMS CORE MODULES
    // ==========================================
    { name: 'IT Assets', path: '/assets', icon: Laptop, perm: 'assets.view' },
    { name: 'Two-Way Radios', path: '/two-way-radios', icon: Radio, perm: 'assets.view' },
    { name: 'Equipment Calculator', path: '/calculator', icon: Calculator },
    { name: 'Help Desk', path: '/tickets', icon: Ticket, perm: 'tickets.create' },
    { name: 'Repair Records', path: '/repairs', icon: Wrench, perm: 'repairs.view' },
    { name: 'Preventive Maint.', path: '/maintenance', icon: Calendar, perm: 'maintenance.view' },
    { name: 'Spare Parts', path: '/inventory', icon: Package, perm: 'inventory.view' },
    { name: 'Software Licenses', path: '/licenses', icon: Key, perm: 'licenses.view' },
    
    // ==========================================
    // IT OPERATIONS HUB
    // ==========================================
    { 
      isDropdown: true, 
      name: 'IT Operations Hub',
      icon: Server,
      items: [
        { name: 'Remote Management', path: '/remote-management', icon: Radio, perm: 'remote_device.view' },
        { name: 'Web & App Filtering MDM', path: '/web-filtering', icon: Shield, perm: 'assets.view' },
        { name: 'Backups', path: '/backups', icon: Database, perm: 'backups.view' },
        { name: 'Endpoint Security', path: '/endpoints', icon: Shield, perm: 'endpoint_security.view' },
        { name: 'Network & IP', path: '/network', icon: Network, perm: 'network.view' },
        { name: 'Printers', path: '/printers', icon: Printer, perm: 'printers.view' },
        { name: 'File Shares', path: '/file-shares', icon: Folder, perm: 'file_shares.view' },
        { name: 'Guest WiFi', path: '/guest-wifi', icon: Wifi, perm: 'guest_wifi.view' },
        { name: 'Websites', path: '/websites', icon: Globe, perm: 'websites.view' },
      ]
    },

    // ==========================================
    // ADMINISTRATION & PLATFORM
    // ==========================================
    { 
      isDropdown: true, 
      name: 'Administration',
      icon: Settings,
      items: [
        { name: 'API Gateway Platform', path: '/api-platform', icon: Shield, perm: 'settings.manage' },
        { name: 'Employees & Users', path: '/employees', icon: Users, perm: 'users.view' },
        { name: 'Unified Reports', path: '/reports', icon: FileBarChart, perm: 'reports.view' },
        { name: 'Audit Logs', path: '/audit-logs', icon: History, perm: 'audit_logs.view' },
        { name: 'System Settings', path: '/settings', icon: Settings, perm: 'settings.manage' },
      ]
    }
  ];

  const filteredMenu = menuItems.map(item => {
    if (item.isDropdown) {
      const filteredItems = item.items.filter(subItem => !subItem.perm || hasPermission(subItem.perm));
      return { ...item, items: filteredItems };
    }
    if (item.name === 'Help Desk') {
      if (hasPermission('tickets.view_all') || hasPermission('tickets.view_own')) return item;
      return null;
    }
    if (!item.perm || hasPermission(item.perm)) return item;
    return null;
  }).filter(item => item !== null && (!item.isDropdown || item.items.length > 0));

  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(x => x);
    return (
      <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium my-2">
        <Link to="/" className="hover:text-slate-800 transition-colors">Home</Link>
        {paths.map((p, idx) => {
          const pathUrl = `/${paths.slice(0, idx + 1).join('/')}`;
          const isLast = idx === paths.length - 1;
          const formattedName = p.toUpperCase() === 'PPE' ? 'PPE' : (p.charAt(0).toUpperCase() + p.slice(1).replace(/-/g, ' '));
          return (
            <React.Fragment key={p}>
              <ChevronRight className="h-3 w-3" />
              {isLast ? (
                <span className="text-slate-800 font-semibold">{formattedName}</span>
              ) : (
                <Link to={pathUrl} className="hover:text-slate-800 transition-colors">{formattedName}</Link>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const handleNotificationClick = async (notif) => {
    await markNotificationAsRead(notif.id);
    setNotifDropdownOpen(false);
    
    // Redirect to related records
    if (notif.related_module === 'Tickets') {
      navigate(`/tickets/${notif.related_record_id}`);
    } else if (notif.related_module === 'Assets') {
      navigate(`/assets/${notif.related_record_id}`);
    } else if (notif.related_module === 'Repairs') {
      navigate(`/repairs/${notif.related_record_id}`);
    } else if (notif.related_module === 'Maintenance') {
      navigate(`/maintenance/${notif.related_record_id}`);
    } else if (notif.related_module === 'Licenses') {
      navigate(`/licenses/${notif.related_record_id}`);
    } else if (notif.related_module === 'Inventory') {
      navigate(`/inventory/${notif.related_record_id}`);
    } else if (notif.related_module === 'PPE') {
      navigate(`/ppe/assets/${notif.related_record_id}`);
    }
  };

  return (
    <div className="h-screen flex bg-slate-50 text-slate-900 overflow-hidden">
      {/* ==========================================
          DESKTOP SIDEBAR
          ========================================== */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-slate-200 border-r border-slate-800 select-none">
        {/* Sidebar Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white shadow-md shadow-emerald-900/40">
              UP
            </div>
            <div>
              <span className="font-bold text-sm tracking-wide text-white block">UNIFIED ITMS+PPE</span>
              <span className="text-[10px] text-slate-400 block tracking-wider uppercase font-semibold">Enterprise Suite</span>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
          {filteredMenu.map((item, idx) => {
            if (item.isDropdown) {
              const isOpen = dropdowns[item.name];
              const isChildActive = item.items.some(sub => location.pathname === sub.path || (sub.path !== '/' && location.pathname.startsWith(sub.path)));
              return (
                <div key={item.name} className="py-1">
                  <button 
                    onClick={() => setDropdowns(prev => ({ ...prev, [item.name]: !isOpen }))}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-150 ${isChildActive ? 'text-emerald-400 bg-slate-800/80' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <span>{item.name}</span>
                    </div>
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  {isOpen && (
                    <div className="mt-1 pl-4 space-y-1 border-l border-slate-800 ml-3">
                      {item.items.map(subItem => {
                        const isActive = location.pathname === subItem.path || (subItem.path !== '/' && location.pathname.startsWith(subItem.path));
                        return (
                          <Link
                            key={subItem.name}
                            to={subItem.path}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                              isActive 
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            <subItem.icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{subItem.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive 
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <item.icon className="h-4.5 w-4.5 flex-shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logged in User panel footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 border border-slate-700">
              <User className="h-4.5 w-4.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.fullName || user?.username}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.roles?.join(', ')}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="mt-2 w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-rose-400 hover:text-white hover:bg-rose-600/20 border border-rose-500/20 rounded-md transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ==========================================
          MOBILE DRAWER SIDEBAR
          ========================================== */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex bg-black/50 animate-fade-in" onClick={() => setMobileMenuOpen(false)}>
          <aside className="w-64 bg-slate-900 flex flex-col animate-slide-right h-full" onClick={e => e.stopPropagation()}>
            <div className="h-16 flex items-center justify-between px-6 bg-slate-950 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white">
                  UP
                </div>
                <span className="font-bold text-sm text-white">Unified ITMS+PPE</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
              {filteredMenu.map((item, idx) => {
                if (item.isDropdown) {
                  const isOpen = dropdowns[item.name];
                  const isChildActive = item.items.some(sub => location.pathname === sub.path || (sub.path !== '/' && location.pathname.startsWith(sub.path)));
                  return (
                    <div key={item.name} className="py-1">
                      <button 
                        onClick={() => setDropdowns(prev => ({ ...prev, [item.name]: !isOpen }))}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider ${isChildActive ? 'text-emerald-400' : 'text-slate-400 hover:text-white'}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <item.icon className="h-4 w-4" />
                          <span>{item.name}</span>
                        </div>
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                      {isOpen && (
                        <div className="mt-1 pl-4 space-y-1 border-l border-slate-800 ml-3">
                          {item.items.map(subItem => {
                            const isActive = location.pathname === subItem.path || (subItem.path !== '/' && location.pathname.startsWith(subItem.path));
                            return (
                              <Link
                                key={subItem.name}
                                to={subItem.path}
                                onClick={() => setMobileMenuOpen(false)}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium ${
                                  isActive 
                                    ? 'bg-emerald-600 text-white' 
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                              >
                                <subItem.icon className="h-4 w-4" />
                                <span>{subItem.name}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                      isActive 
                        ? 'bg-emerald-600 text-white' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <item.icon className="h-4.5 w-4.5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{user?.username}</p>
                  <p className="text-[10px] text-slate-400 truncate">{user?.roles?.[0]}</p>
                </div>
              </div>
              <button 
                onClick={logout}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2 text-xs text-rose-400 bg-rose-950/20 border border-rose-900/50 rounded"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ==========================================
          MAIN AREA (Top nav & Content viewport)
          ========================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* TOP NAVBAR */}
        <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm shadow-slate-100">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden text-slate-600 hover:text-slate-900 focus:outline-none"
            >
              <Menu className="h-6 w-6" />
            </button>
            
            <div className="hidden lg:flex items-center gap-3 select-none">
              <span className="text-slate-900 font-bold text-base">Unified ITMS + PPE Enterprise System</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Production Release v1.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            
            {/* Real-time Notifications Bell */}
            <div className="relative">
              <button 
                onClick={() => {
                  setNotifDropdownOpen(!notifDropdownOpen);
                  setProfileDropdownOpen(false);
                }}
                className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 relative transition-colors"
              >
                <Bell className="h-5 w-5" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-4 min-w-4 px-1 rounded-full bg-rose-600 text-[10px] font-bold text-white flex items-center justify-center border border-white">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Panel */}
              {notifDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50 animate-fade-in">
                  <div className="p-3 bg-slate-900 text-white font-semibold text-xs flex justify-between items-center">
                    <span>Notifications ({unreadNotificationsCount} unread)</span>
                    <button 
                      onClick={() => setNotifDropdownOpen(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {notifications && notifications.length > 0 ? (
                      notifications.map(notif => (
                        <div 
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-3 text-xs cursor-pointer hover:bg-slate-50 transition-colors ${!notif.is_read ? 'bg-slate-50 font-medium' : ''}`}
                        >
                          <p className="text-slate-800">{notif.title}</p>
                          <p className="text-slate-500 mt-0.5 leading-normal">{notif.message}</p>
                          <span className="text-[10px] text-slate-400 block mt-1">
                            {new Date(notif.created_at).toLocaleDateString()} {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-xs text-slate-400">
                        No notifications available.
                      </div>
                    )}
                  </div>
                  <div className="p-2 border-t border-slate-100 bg-slate-50 text-center">
                    <span 
                      onClick={() => setNotifDropdownOpen(false)}
                      className="text-[11px] font-semibold text-emerald-700 cursor-pointer hover:underline"
                    >
                      Close Panel
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown Menu */}
            <div className="relative">
              <button 
                onClick={() => {
                  setProfileDropdownOpen(!profileDropdownOpen);
                  setNotifDropdownOpen(false);
                }}
                className="flex items-center gap-2 h-10 px-3 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center border border-slate-350">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:block text-xs font-semibold">{user?.username}</span>
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50 animate-fade-in">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-900">{user?.fullName || user?.username}</p>
                    <p className="text-[10px] text-slate-500 truncate">{user?.email || 'System User'}</p>
                  </div>
                  
                  <Link 
                    to="/change-password" 
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                  >
                    <Lock className="h-3.5 w-3.5 text-slate-500" />
                    <span>Change Password</span>
                  </Link>

                  <button 
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-600 hover:bg-slate-100 text-left"
                  >
                    <LogOut className="h-3.5 w-3.5 text-rose-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* SCROLLABLE VIEWPORT CONTENT */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 max-w-7xl w-full mx-auto pb-24 md:pb-6">
          {getBreadcrumbs()}
          <div className="mt-4">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ==========================================
          MOBILE BOTTOM NAVIGATION BAR (PHONE VIEW)
          ========================================== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950 border-t border-slate-800/80 backdrop-blur-lg px-2 py-1.5 flex justify-around items-center text-[10px] font-bold shadow-2xl">
        <Link
          to="/"
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors ${
            location.pathname === '/' ? 'text-emerald-400 bg-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>Dashboard</span>
        </Link>

        <Link
          to="/ppe"
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors ${
            location.pathname.startsWith('/ppe') ? 'text-emerald-400 bg-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="h-5 w-5" />
          <span>PPE</span>
        </Link>

        <Link
          to="/assets"
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors ${
            location.pathname.startsWith('/assets') ? 'text-emerald-400 bg-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Laptop className="h-5 w-5" />
          <span>IT Assets</span>
        </Link>

        <Link
          to="/tickets"
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors ${
            location.pathname.startsWith('/tickets') ? 'text-emerald-400 bg-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Ticket className="h-5 w-5" />
          <span>Help Desk</span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors cursor-pointer ${
            mobileMenuOpen ? 'text-emerald-400 bg-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Menu className="h-5 w-5" />
          <span>Menu</span>
        </button>
      </nav>
    </div>
  );
}
