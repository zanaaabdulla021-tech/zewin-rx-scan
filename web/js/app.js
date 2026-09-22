(async function(){
  // Load each view's HTML from its own file and inject it into the shared
  // <main> containers before anything else runs, so every element lookup
  // below still finds what it expects (behavior unchanged, just where the
  // markup physically lives).
  async function loadViewFragments(){
    const appViews = ['scan', 'history', 'reports', 'admin', 'account'];
    const saViews = ['sa-dashboard', 'sa-pharmacies', 'sa-company-detail', 'sa-payments', 'sa-activity', 'sa-admins'];
    const [appHtml, saHtml] = await Promise.all([
      Promise.all(appViews.map(v => fetch('views/' + v + '.html').then(r => r.text()))),
      Promise.all(saViews.map(v => fetch('views/' + v + '.html').then(r => r.text()))),
    ]);
    const appMain = document.getElementById('app-main');
    const saMain = document.getElementById('sa-main');
    appMain.innerHTML = appHtml.join('\n');
    saMain.innerHTML = saHtml.join('\n');
    // Alpine.js (deferred) may not have started yet — wait for it, then have
    // it scan this freshly-injected HTML for the :class="..." bindings we
    // added, so they pick up the activeView state from the parent scope.
    await waitForAlpine();
    Alpine.initTree(appMain);
    Alpine.initTree(saMain);
  }
  function waitForAlpine(){
    return new Promise((resolve) => {
      if (window.Alpine) return resolve();
      const check = setInterval(() => {
        if (window.Alpine){ clearInterval(check); resolve(); }
      }, 10);
    });
  }
  await loadViewFragments();

  // Alpine.js owns which view is showing (x-data="{ activeView: ... }" on
  // #app-screen / #superadmin-screen); this lets plain JS change it too.
  function setActiveView(screenId, viewId){
    const el = document.getElementById(screenId);
    if (el && window.Alpine) Alpine.$data(el).activeView = viewId;
  }

  // ---- Point this at your deployed backend (see /backend/README.md) ----
  const BACKEND_URL = 'https://zewin-rx-scan.vercel.app';
  const LOGO_DATA_URI = 'icon-512.png';

  let token = localStorage.getItem('rxscan_token') || null;
  let currentUser = null;

  const $ = (id) => document.getElementById(id);
  const loginScreen = $('login-screen');
  const appScreen = $('app-screen');
  const superadminScreen = $('superadmin-screen');

  async function api(path, options) {
    options = options || {};
    const headers = Object.assign({'Content-Type':'application/json'}, options.headers || {});
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(BACKEND_URL + path, Object.assign({}, options, { headers }));
    if (res.status === 401) {
      logout();
      throw new Error('unauthorized');
    }
    if (!res.ok) {
      let body = {};
      try { body = await res.json(); } catch(e){}
      throw Object.assign(new Error(body.error || 'request_failed'), { status: res.status, body });
    }
    if (res.status === 204) return null;
    return res.json();
  }

  function showConfirm(message, opts){
    opts = opts || {};
    return new Promise((resolve) => {
      const modal = $('confirm-modal');
      $('confirm-modal-title').textContent = opts.title || 'Are you sure?';
      $('confirm-modal-message').textContent = message;
      $('confirm-modal-ok').textContent = opts.okLabel || 'Delete';
      modal.style.display = 'flex';
      const okBtn = $('confirm-modal-ok');
      const cancelBtn = $('confirm-modal-cancel');
      const cleanup = (result) => {
        modal.style.display = 'none';
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        resolve(result);
      };
      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
    });
  }

  function logout(){
    token = null;
    currentUser = null;
    localStorage.removeItem('rxscan_token');
    appScreen.style.display = 'none';
    superadminScreen.style.display = 'none';
    loginScreen.style.display = 'flex';
  }

  async function loadNotifications(){
    try{
      const data = await api('/api/notifications');
      const badge = $('notif-badge');
      if (data.unreadCount > 0){
        badge.textContent = data.unreadCount > 99 ? '99+' : data.unreadCount;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
      $('notif-list').innerHTML = data.notifications.map(n => (
        '<div data-notif-id="'+n.id+'" style="padding:9px 4px;border-bottom:1px solid var(--line);cursor:pointer;'+(n.read?'opacity:0.55;':'')+'">'+
          '<div style="font-size:12.5px;font-weight:'+(n.read?'400':'700')+';">'+escapeHtml(n.title)+'</div>'+
          (n.body ? '<div style="font-size:11.5px;color:var(--ink-soft);margin-top:2px;">'+escapeHtml(n.body)+'</div>' : '')+
          '<div style="font-size:10.5px;color:var(--ink-soft);margin-top:2px;">'+new Date(n.createdAt).toLocaleString()+'</div>'+
        '</div>'
      )).join('') || '<div class="empty-hist">No notifications</div>';
      $('notif-list').querySelectorAll('[data-notif-id]').forEach(el => {
        el.addEventListener('click', async () => {
          try{
            await api('/api/notifications/'+el.dataset.notifId+'/read', {method:'POST'});
            await loadNotifications();
          } catch(e){}
        });
      });
    } catch(e){}
  }

  $('notif-btn').addEventListener('click', () => {
    const panel = $('notif-panel');
    const opening = panel.style.display === 'none';
    panel.style.display = opening ? 'block' : 'none';
    if (opening) loadNotifications();
  });

  $('notif-mark-all-btn').addEventListener('click', async () => {
    try{
      await api('/api/notifications/read-all', {method:'POST'});
      await loadNotifications();
    } catch(e){}
  });

  function populateCompanySwitcher(){
    const sel = $('company-switcher');
    const companies = currentUser.companies || [];
    if (companies.length < 2){
      sel.style.display = 'none';
      sel.innerHTML = '';
      return;
    }
    sel.innerHTML = companies.map(c =>
      '<option value="'+c.organizationId+'"'+(c.organizationName===currentUser.organizationName?' selected':'')+'>'+escapeHtml(c.organizationName)+'</option>'
    ).join('');
    sel.style.display = 'block';
  }

  $('company-switcher').addEventListener('change', async (e) => {
    const organizationId = Number(e.target.value);
    try{
      const data = await api('/api/auth/switch-company', {
        method:'POST',
        body: JSON.stringify({organizationId})
      });
      token = data.token;
      currentUser = { ...data.user, companies: data.companies || [] };
      localStorage.setItem('rxscan_token', token);
      await enterApp();
    } catch(e){
      showToast('Could not switch companies', 'error');
    }
  });

  $('logout-btn').addEventListener('click', logout);
  $('sa-logout-btn').addEventListener('click', logout);

  $('login-btn').addEventListener('click', async () => {
    const email = $('login-email').value.trim();
    const password = $('login-password').value;
    $('login-error').style.display = 'none';
    try{
      const data = await api('/api/auth/login', {
        method:'POST',
        body: JSON.stringify({email, password})
      });
      token = data.token;
      currentUser = { ...data.user, companies: data.companies || [] };
      localStorage.setItem('rxscan_token', token);
      enterApp();
    } catch(e){
      $('login-error').textContent = 'Incorrect email or password';
      $('login-error').style.display = 'block';
    }
  });

  // ---- register a brand-new pharmacy (organization) ----
  $('show-register-btn').addEventListener('click', () => {
    document.querySelector('.login-card:not(#register-card)').style.display = 'none';
    $('register-card').style.display = 'block';
  });
  $('show-login-btn').addEventListener('click', () => {
    $('register-card').style.display = 'none';
    document.querySelector('.login-card:not(#register-card)').style.display = 'block';
  });

  $('register-btn').addEventListener('click', async () => {
    const organizationName = $('reg-org-name').value.trim();
    const branchName = $('reg-branch-name').value.trim();
    const adminEmail = $('reg-admin-email').value.trim();
    const adminPassword = $('reg-admin-password').value;
    $('register-error').style.display = 'none';
    if (!organizationName || !adminEmail || !adminPassword){
      $('register-error').textContent = 'Please fill in the pharmacy name, email, and password';
      $('register-error').style.display = 'block';
      return;
    }
    $('register-btn').disabled = true;
    try{
      const data = await api('/api/auth/register-organization', {
        method:'POST',
        body: JSON.stringify({organizationName, branchName, adminEmail, adminPassword})
      });
      token = data.token;
      currentUser = { ...data.user, companies: data.companies || [] };
      localStorage.setItem('rxscan_token', token);
      enterApp();
    } catch(e){
      $('register-error').textContent = 'That email is already taken, or something went wrong';
      $('register-error').style.display = 'block';
    } finally {
      $('register-btn').disabled = false;
    }
  });

  let knownItemNames = [];
  async function loadKnownItemNames(){
    try{
      knownItemNames = await api('/api/item-names');
    } catch(e){}
  }

  async function enterApp(){
    loginScreen.style.display = 'none';
    if (currentUser.role === 'super_admin'){
      appScreen.style.display = 'none';
      superadminScreen.style.display = 'flex';
      await loadSuperAdminOverview();
      await loadCompanies();
      await loadSuperAdminActivityLog();
      await loadSuperAdminPayments();
      await loadPendingBranches();
      return;
    }
    appScreen.style.display = 'flex';
    $('branch-tag').textContent = (currentUser.organizationName ? currentUser.organizationName + ' · ' : '') + (currentUser.branchName || 'No branch') + ' · ' + currentUser.email;
    populateCompanySwitcher();
    const isOrgManager = currentUser.role === 'owner' || currentUser.role === 'company_admin';
    const isOrgReader = isOrgManager || currentUser.role === 'viewer';
    $('admin-tab-btn').style.display = isOrgManager ? 'block' : 'none';
    $('reports-tab-btn').style.display = isOrgReader ? 'block' : 'none';
    $('scan-tab-btn').style.display = currentUser.role === 'viewer' ? 'none' : 'block';
    if (currentUser.role === 'viewer'){
      setActiveView('app-screen', 'history-view');
    }
    fillAccountInfo();
    await loadSubscriptionInfo();
    await loadNotifications();
    await loadHistory();
    loadKnownItemNames();
    if (isOrgManager){
      await loadBranches();
      await loadUsers();
      await loadActivityLog();
    }
    if (isOrgReader){
      await loadReports();
    }
  }

  async function loadSuperAdminOverview(){
    try{
      const data = await api('/api/superadmin/overview');
      $('sa-overview').innerHTML =
        statCard('Total companies', data.totalCompanies, 'company') +
        statCard('Active companies', data.activeCompanies, 'active') +
        statCard('Total users', data.totalUsers, 'users') +
        statCard('Est. monthly revenue', '$'+data.estimatedMonthlyRevenue, 'revenue');
      const firstCard = $('sa-overview').querySelector('.stat-card');
      if (firstCard){
        firstCard.style.cursor = 'pointer';
        firstCard.addEventListener('click', () => {
          document.querySelector('#sa-tabs [data-saview="sa-companies-view"]').click();
        });
      }

      renderBarChart('sa-chart-orgs', data.organizationsGrowth||[], {horizontal:false});
      renderBarChart('sa-chart-scans', data.scansGrowth||[], {horizontal:false});

      $('sa-recent-companies').innerHTML = (data.recentCompanies||[]).map(c => (
        '<div class="org-card" data-open-recent-company="'+c.id+'">'+
          '<div class="org-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1M9 13h1M14 9h1M14 13h1"/></svg></div>'+
          '<div class="org-card-body"><div class="org-card-name">'+escapeHtml(c.name)+'</div><div class="org-card-meta">'+c.branchCount+' branches · '+c.userCount+' users · '+c.plan+' plan</div></div>'+
          '<span class="status-badge '+(c.status==='active'?'approved':(c.status==='suspended'||c.status==='expired'?'rejected':'pending'))+'">'+c.status+'</span>'+
        '</div>'
      )).join('') || '<div class="empty-hist">No companies yet</div>';
      $('sa-recent-companies').querySelectorAll('[data-open-recent-company]').forEach(row => {
        row.addEventListener('click', () => openCompanyDetail(Number(row.dataset.openRecentCompany)));
      });
    } catch(e){
      $('sa-overview').innerHTML = '<div class="empty-hist">Could not load the overview</div>';
    }
  }

  function activityIconClass(action){
    if (action.indexOf('company') === 0) return 'type-org';
    if (action.indexOf('branch') === 0) return 'type-branch';
    if (action.indexOf('user') === 0 || action === 'login') return 'type-user';
    if (action.indexOf('prescription') === 0) return 'type-rx';
    if (action.indexOf('payment') === 0) return 'type-payment';
    return 'type-org';
  }
  function activityIconSvg(action){
    const icons = {
      org: '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1M9 13h1M14 9h1M14 13h1"/>',
      branch: '<path d="M4 8a2 2 0 012-2h1.5l1-1.5h7l1 1.5H18a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8z"/><circle cx="12" cy="13" r="3.5"/>',
      user: '<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>',
      rx: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
      payment: '<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
    };
    const key = activityIconClass(action).replace('type-','');
    return '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(icons[key]||icons.org)+'</svg>';
  }

  function relativeTime(iso){
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs/60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins+'m ago';
    const hrs = Math.round(mins/60);
    if (hrs < 24) return hrs+'h ago';
    const days = Math.round(hrs/24);
    return days+'d ago';
  }

  let allCompanies = [];

  async function loadCompanies(){
    try{
      allCompanies = await api('/api/superadmin/companies');
      renderCompaniesTable(allCompanies);
    } catch(e){
      $('sa-companies-tbody').innerHTML = '<tr><td colspan="9" style="padding:20px;text-align:center;color:var(--ink-soft);">Could not load companies</td></tr>';
    }
  }

  function planBadge(plan){
    const colors = {free:'pending', basic:'pending', business:'approved', enterprise:'approved'};
    return '<span class="status-badge '+(colors[plan]||'pending')+'" style="text-transform:capitalize;">'+plan+'</span>';
  }

  function renderCompaniesTable(companies){
    const td = 'padding:11px 12px;vertical-align:middle;border-bottom:1px solid var(--line);';
    $('sa-companies-tbody').innerHTML = companies.map(c => {
      const location = [c.city, c.country].filter(Boolean).join(', ') || '—';
      const expired = c.expiryDate && new Date(c.expiryDate).getTime() < Date.now();
      return '<tr>'+
        '<td style="'+td+'"><div style="display:flex;align-items:center;gap:8px;cursor:pointer;" data-open-company="'+c.id+'">'+
          (c.logoData ? '<img src="'+c.logoData+'" style="width:28px;height:28px;border-radius:7px;object-fit:cover;flex-shrink:0;">' : '<div style="width:28px;height:28px;border-radius:7px;background:var(--brand-tint);flex-shrink:0;"></div>')+
          '<b style="font-weight:600;">'+escapeHtml(c.name)+'</b>'+
        '</div></td>'+
        '<td style="'+td+'">'+planBadge(c.plan)+'</td>'+
        '<td style="'+td+'"><span class="status-badge '+(c.status==='active'?'approved':(c.status==='suspended'||c.status==='expired'?'rejected':'pending'))+'">'+c.status+'</span></td>'+
        '<td style="'+td+'color:var(--ink-soft);">'+escapeHtml(location)+'</td>'+
        '<td style="'+td+'">'+c.branchCount+'</td>'+
        '<td style="'+td+'">'+c.userCount+'</td>'+
        '<td style="'+td+'"><b>$'+c.billing.totalCost+'</b><span style="color:var(--ink-soft);">/'+(c.billing.cycle==='yearly'?'yr':'mo')+'</span></td>'+
        '<td style="'+td+(expired?'color:var(--danger);font-weight:600;':'color:var(--ink-soft);')+'">'+(c.expiryDate ? c.expiryDate.slice(0,10) : '—')+(expired?' (expired)':'')+'</td>'+
        '<td style="'+td+'"><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">'+
          (c.status !== 'active' ? '<button type="button" class="approve-btn" data-activate="'+c.id+'">Activate</button>' : '')+
          (c.status !== 'suspended' ? '<button type="button" class="reject-btn" data-suspend="'+c.id+'">Suspend</button>' : '')+
          '<button type="button" class="del-btn" data-delete="'+c.id+'">Delete</button>'+
          '<select data-plan-select="'+c.id+'" title="Change plan" style="font-size:11.5px;padding:3px 4px;border-radius:6px;border:1px solid var(--line);color:var(--ink-soft);">'+
            ['free','basic','business','enterprise'].map(p => '<option value="'+p+'"'+(p===c.plan?' selected':'')+'>'+p+'</option>').join('')+
          '</select>'+
        '</div></td>'+
      '</tr>';
    }).join('') || '<tr><td colspan="9" style="padding:20px;text-align:center;color:var(--ink-soft);">No companies yet</td></tr>';

    $('sa-companies-tbody').querySelectorAll('[data-activate]').forEach(btn => {
      btn.addEventListener('click', () => setCompanyStatus(btn.dataset.activate, 'active'));
    });
    $('sa-companies-tbody').querySelectorAll('[data-suspend]').forEach(btn => {
      btn.addEventListener('click', () => setCompanyStatus(btn.dataset.suspend, 'suspended'));
    });
    $('sa-companies-tbody').querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => deleteCompany(btn.dataset.delete));
    });
    $('sa-companies-tbody').querySelectorAll('[data-plan-select]').forEach(sel => {
      sel.addEventListener('change', () => setCompanyPlan(sel.dataset.planSelect, sel.value));
    });
    $('sa-companies-tbody').querySelectorAll('[data-open-company]').forEach(el => {
      el.addEventListener('click', () => openCompanyDetail(Number(el.dataset.openCompany)));
    });
  }

  $('sa-company-back-btn').addEventListener('click', () => {
    setActiveView('superadmin-screen', 'sa-companies-view');
  });

  async function openCompanyDetail(id){
    setActiveView('superadmin-screen', 'sa-company-detail-view');
    $('sa-branch-team-section').style.display = 'none';
    $('sa-company-detail-name').textContent = 'Loading...';
    $('sa-company-branch-list').innerHTML = '';
    try{
      const [company, branches] = await Promise.all([
        api('/api/superadmin/companies/'+id),
        api('/api/superadmin/companies/'+id+'/branches'),
      ]);
      $('sa-company-detail-name').textContent = company.name;
      $('sa-company-detail-sub').textContent = company.status+' · '+company.plan+' plan · '+company.branchCount+' branches · '+company.userCount+' users';
      $('sa-company-branch-list').innerHTML = branches.map(b => (
        '<div class="branch-card">'+
          '<div class="branch-card-head">'+
            '<div class="name"><span class="branch-icon">'+BRANCH_ICON_SVG+'</span>'+escapeHtml(b.name)+'</div>'+
            (b.approved === false ? '<span class="status-badge pending">Pending approval</span>' : '<span class="status-badge approved">Active</span>')+
          '</div>'+
          '<div class="branch-stat-row">'+
            '<div><div class="bs-label">Users</div><div class="bs-value">'+b.userCount+'</div></div>'+
            '<div><div class="bs-label">Prescriptions</div><div class="bs-value">'+b.prescriptionCount+'</div></div>'+
            '<div><div class="bs-label">Scans today</div><div class="bs-value">'+b.scansToday+'</div></div>'+
            '<div><div class="bs-label">Manager</div><div class="bs-value" style="font-size:12.5px;">'+escapeHtml(b.managerEmail||'—')+'</div></div>'+
          '</div>'+
          '<button class="btn-ghost" type="button" data-view-team="'+b.id+'" data-branch-name="'+escapeAttr(b.name)+'">View team</button>'+
        '</div>'
      )).join('') || '<div class="empty-hist">No branches</div>';
      $('sa-company-branch-list').querySelectorAll('[data-view-team]').forEach(btn => {
        btn.addEventListener('click', () => showBranchTeam(Number(btn.dataset.viewTeam), btn.dataset.branchName, company.users));
      });
    } catch(e){
      $('sa-company-detail-name').textContent = 'Could not load this company';
    }
  }

  function showBranchTeam(branchId, branchName, allUsers){
    const section = $('sa-branch-team-section');
    section.style.display = 'flex';
    $('sa-branch-team-title').textContent = 'Team — ' + branchName;
    const team = (allUsers||[]).filter(u => u.branchId === branchId);
    $('sa-branch-team-list').innerHTML = team.map(u => (
      '<div class="admin-row"><span>'+escapeHtml(u.email)+'<div class="meta">'+roleLabel(u.role)+'</div></span></div>'
    )).join('') || '<div class="empty-hist">No one assigned to this branch yet</div>';
    section.scrollIntoView({behavior:'smooth', block:'start'});
  }

  $('sa-company-search').addEventListener('input', () => {
    const term = $('sa-company-search').value.trim().toLowerCase();
    if (!term){ renderCompaniesTable(allCompanies); return; }
    renderCompaniesTable(allCompanies.filter(c =>
      [c.name, c.city, c.country, c.status, c.plan].some(v => (v||'').toLowerCase().includes(term))
    ));
  });

  async function setCompanyPlan(id, plan){
    try{
      await api('/api/superadmin/companies/'+id+'/plan', {method:'POST', body: JSON.stringify({plan})});
      await loadCompanies();
    } catch(e){}
  }

  async function setCompanyBillingCycle(id, billingCycle){
    try{
      await api('/api/superadmin/companies/'+id+'/billing-cycle', {method:'POST', body: JSON.stringify({billingCycle})});
      await loadCompanies();
    } catch(e){}
  }

  async function setCompanyExpiry(id, expiryDate){
    try{
      await api('/api/superadmin/companies/'+id, {method:'PATCH', body: JSON.stringify({expiryDate})});
      await loadCompanies();
    } catch(e){}
  }

  $('sa-create-admin-btn').addEventListener('click', async () => {
    const email = $('sa-new-admin-email2').value.trim();
    const password = $('sa-new-admin-password2').value;
    $('sa-create-admin-msg').innerHTML = '';
    if (!email || !password){
      $('sa-create-admin-msg').innerHTML = '<div class="admin-row" style="color:#8C2C20;">Email and password are required</div>';
      return;
    }
    $('sa-create-admin-btn').disabled = true;
    try{
      await api('/api/superadmin/create-admin', {method:'POST', body: JSON.stringify({email, password})});
      $('sa-new-admin-email2').value = '';
      $('sa-new-admin-password2').value = '';
      $('sa-create-admin-msg').innerHTML = '<div class="admin-row" style="color:#016E51;">Super admin created</div>';
    } catch(e){
      $('sa-create-admin-msg').innerHTML = '<div class="admin-row" style="color:#8C2C20;">That email is already taken, or something went wrong</div>';
    } finally {
      $('sa-create-admin-btn').disabled = false;
    }
  });

  async function loadSuperAdminPayments(){
    try{
      const payments = await api('/api/superadmin/payments?status=pending');
      $('sa-payments').innerHTML = payments.map(p => (
        '<div class="admin-row" style="flex-direction:column;align-items:stretch;gap:6px;">'+
          '<div style="display:flex;justify-content:space-between;"><b>'+escapeHtml(p.companyName||'—')+'</b><span class="meta">$'+p.amount+' '+p.currency+'</span></div>'+
          '<span class="meta">'+escapeHtml(p.requestedBy||'')+' · '+new Date(p.createdAt).toLocaleString()+(p.reference?' · '+escapeHtml(p.reference):'')+'</span>'+
          '<div style="display:flex;gap:8px;">'+
            '<button type="button" class="approve-btn" data-approve-payment="'+p.id+'">Approve</button>'+
            '<button type="button" class="reject-btn" data-reject-payment="'+p.id+'">Reject</button>'+
          '</div>'+
        '</div>'
      )).join('') || '<div class="empty-hist">No pending payment requests</div>';
      $('sa-payments').querySelectorAll('[data-approve-payment]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try{ await api('/api/superadmin/payments/'+btn.dataset.approvePayment+'/approve', {method:'POST'}); await loadSuperAdminPayments(); await loadCompanies(); } catch(e){}
        });
      });
      $('sa-payments').querySelectorAll('[data-reject-payment]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try{ await api('/api/superadmin/payments/'+btn.dataset.rejectPayment+'/reject', {method:'POST'}); await loadSuperAdminPayments(); } catch(e){}
        });
      });
    } catch(e){
      $('sa-payments').innerHTML = '<div class="empty-hist">Could not load payment requests</div>';
    }
  }

  async function loadPendingBranches(){
    try{
      const branches = await api('/api/superadmin/branches/pending');
      $('sa-pending-branches').innerHTML = branches.map(b => (
        '<div class="admin-row" style="flex-direction:column;align-items:stretch;gap:6px;">'+
          '<div style="display:flex;justify-content:space-between;"><b>'+escapeHtml(b.name)+'</b><span class="meta">'+escapeHtml(b.companyName||'—')+'</span></div>'+
          '<span class="meta">Requested '+new Date(b.createdAt).toLocaleString()+'</span>'+
          '<div style="display:flex;gap:8px;">'+
            '<button type="button" class="approve-btn" data-approve-branch="'+b.id+'">Approve</button>'+
            '<button type="button" class="reject-btn" data-reject-branch="'+b.id+'">Reject</button>'+
          '</div>'+
        '</div>'
      )).join('') || '<div class="empty-hist">No pending branch requests</div>';
      $('sa-pending-branches').querySelectorAll('[data-approve-branch]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try{
            await api('/api/superadmin/branches/'+btn.dataset.approveBranch+'/approve', {method:'POST'});
            showToast('Branch approved', 'success');
            await loadPendingBranches();
          } catch(e){ showToast('Could not approve the branch', 'error'); }
        });
      });
      $('sa-pending-branches').querySelectorAll('[data-reject-branch]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try{
            await api('/api/superadmin/branches/'+btn.dataset.rejectBranch+'/reject', {method:'POST'});
            showToast('Branch rejected', 'info');
            await loadPendingBranches();
          } catch(e){ showToast('Could not reject the branch', 'error'); }
        });
      });
    } catch(e){
      $('sa-pending-branches').innerHTML = '<div class="empty-hist">Could not load pending branches</div>';
    }
  }

  async function loadSuperAdminActivityLog(){
    try{
      const logs = await api('/api/superadmin/activity-logs');
      $('sa-activity-log').innerHTML = logs.map(l => {
        const when = new Date(l.createdAt).toLocaleString();
        return '<div class="admin-row" style="flex-direction:column;align-items:stretch;gap:2px;">'+
          '<div style="display:flex;justify-content:space-between;"><b>'+escapeHtml(activityActionLabel(l.action))+'</b><span class="meta">'+escapeHtml(when)+'</span></div>'+
          '<span class="meta">'+escapeHtml(l.userEmail||'—')+(l.companyName ? ' · '+escapeHtml(l.companyName) : '')+(l.details ? ' · '+escapeHtml(l.details) : '')+'</span>'+
        '</div>';
      }).join('') || '<div class="empty-hist">No activity yet</div>';
    } catch(e){
      $('sa-activity-log').innerHTML = '<div class="empty-hist">Could not load the activity log</div>';
    }
  }

  async function setCompanyStatus(id, status){
    try{
      await api('/api/superadmin/companies/'+id+'/status', {method:'POST', body: JSON.stringify({status})});
      await loadCompanies();
      await loadSuperAdminOverview();
    } catch(e){}
  }

  async function deleteCompany(id){
    const ok = await showConfirm('Delete this company and everything in it? This cannot be undone.', {title: 'Delete company?'});
    if (!ok) return;
    try{
      await api('/api/superadmin/companies/'+id, {method:'DELETE'});
      await loadCompanies();
      await loadSuperAdminOverview();
      showToast('Company deleted', 'success');
    } catch(e){
      showToast('Could not delete the company', 'error');
    }
  }

  $('sa-create-btn').addEventListener('click', async () => {
    const name = $('sa-new-name').value.trim();
    const branchName = $('sa-new-branch').value.trim();
    const adminEmail = $('sa-new-admin-email').value.trim();
    const adminPassword = $('sa-new-admin-password').value;
    const phone = $('sa-new-phone').value.trim();
    const email = $('sa-new-email').value.trim();
    const city = $('sa-new-city').value.trim();
    const country = $('sa-new-country').value.trim();
    const plan = $('sa-new-plan').value;
    const billingCycle = $('sa-new-billing').value;
    $('sa-create-msg').innerHTML = '';
    if (!name){
      $('sa-create-msg').innerHTML = '<div class="admin-row" style="color:#8C2C20;">Company name is required</div>';
      return;
    }
    $('sa-create-btn').disabled = true;
    try{
      await api('/api/superadmin/companies', {
        method:'POST',
        body: JSON.stringify({name, branchName, adminEmail, adminPassword, phone, email, city, country, plan, billingCycle})
      });
      $('sa-new-name').value = '';
      $('sa-new-branch').value = '';
      $('sa-new-admin-email').value = '';
      $('sa-new-admin-password').value = '';
      $('sa-new-phone').value = '';
      $('sa-new-email').value = '';
      $('sa-new-city').value = '';
      $('sa-new-country').value = '';
      $('sa-new-plan').value = 'free';
      $('sa-new-billing').value = 'monthly';
      $('sa-create-msg').innerHTML = '<div class="admin-row" style="color:#016E51;">Company created</div>';
      await loadCompanies();
      await loadSuperAdminOverview();
    } catch(e){
      $('sa-create-msg').innerHTML = '<div class="admin-row" style="color:#8C2C20;">That email is already taken, or something went wrong</div>';
    } finally {
      $('sa-create-btn').disabled = false;
    }
  });

  function fillAccountInfo(){
    $('account-info').innerHTML =
      '<div class="admin-row"><span>Pharmacy</span><span class="meta">'+escapeHtml(currentUser.organizationName||'—')+'</span></div>'+
      '<div class="admin-row"><span>Email</span><span class="meta">'+escapeHtml(currentUser.email)+'</span></div>'+
      '<div class="admin-row"><span>Role</span><span class="meta">'+roleLabel(currentUser.role)+'</span></div>'+
      '<div class="admin-row"><span>Branch</span><span class="meta">'+escapeHtml(currentUser.branchName||'No branch')+'</span></div>';
    updateAvatarDisplays();
  }

  async function loadSubscriptionInfo(){
    try{
      const data = await api('/api/company/subscription');
      const u = data.usage, l = data.limits, b = data.billing;
      const fmt = (used, max) => max === null ? used + ' (unlimited)' : used + ' / ' + max;
      const isOrgManager = currentUser.role === 'owner' || currentUser.role === 'company_admin';
      if (isOrgManager){
        $('company-logo-section').style.display = 'block';
        $('payment-section').style.display = 'block';
        await loadPaymentHistory();
        if (data.logoData){
          $('company-logo-preview').innerHTML = '<img src="'+data.logoData+'" style="width:100%;height:100%;object-fit:cover;">';
        }
      }
      let expiryRow = '';
      if (data.expiryDate){
        const expiryDate = new Date(data.expiryDate);
        const expired = expiryDate.getTime() < Date.now();
        expiryRow = '<div class="admin-row"><span>Expires</span><span class="meta"'+(expired?' style="color:var(--danger-deep);font-weight:600;"':'')+'>'+expiryDate.toLocaleDateString()+(expired?' (expired)':'')+'</span></div>';
      }
      $('subscription-info').innerHTML =
        '<div class="admin-row"><span>Plan</span><span class="meta">'+escapeHtml(l.label)+'</span></div>'+
        '<div class="admin-row"><span>Status</span><span class="meta">'+escapeHtml(data.status)+'</span></div>'+
        expiryRow+
        '<div class="admin-row"><span>Branches</span><span class="meta">'+fmt(u.branches, l.maxBranches)+'</span></div>'+
        '<div class="admin-row"><span>Users</span><span class="meta">'+fmt(u.users, l.maxUsers)+'</span></div>'+
        '<div class="admin-row"><span>Scans this month</span><span class="meta">'+fmt(u.scansThisMonth, l.maxScansPerMonth)+'</span></div>'+
        '<div class="admin-row"><span>Billing</span><span class="meta">$'+b.pricePerBranch+' / branch / '+(b.cycle==='yearly'?'year':'month')+'</span></div>'+
        '<div class="admin-row"><span>Total ('+b.branchCount+' branch'+(b.branchCount===1?'':'es')+')</span><span class="meta"><b>$'+b.totalCost+' / '+(b.cycle==='yearly'?'year':'month')+'</b></span></div>';
      $('subscription-section').style.display = 'block';
    } catch(e){
      $('subscription-section').style.display = 'none';
    }
  }

  $('company-logo-pick-btn').addEventListener('click', () => $('company-logo-input').click());
  $('company-logo-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try{
      const b64 = await fileToBase64(file);
      const data = await api('/api/company/logo', {method:'POST', body: JSON.stringify({imageBase64: b64, mediaType: file.type || 'image/png'})});
      $('company-logo-preview').innerHTML = '<img src="'+data.logoData+'" style="width:100%;height:100%;object-fit:cover;">';
    } catch(err){
      showToast('Could not load the logo', 'error');
    }
  });

  async function loadPaymentHistory(){
    try{
      const payments = await api('/api/company/payments');
      $('payment-history').innerHTML = payments.map(p => (
        '<div class="admin-row" style="flex-direction:column;align-items:stretch;gap:2px;">'+
          '<div style="display:flex;justify-content:space-between;"><b>$'+p.amount+'</b><span class="status-badge '+(p.status==='approved'?'approved':(p.status==='rejected'?'rejected':'pending'))+'">'+p.status+'</span></div>'+
          '<span class="meta">'+new Date(p.createdAt).toLocaleString()+(p.reference?' · '+escapeHtml(p.reference):'')+'</span>'+
        '</div>'
      )).join('') || '<div class="empty-hist">No payment requests yet</div>';
    } catch(e){
      $('payment-history').innerHTML = '';
    }
  }

  $('request-payment-btn').addEventListener('click', async () => {
    const reference = $('payment-reference').value.trim();
    $('payment-request-msg').innerHTML = '';
    $('request-payment-btn').disabled = true;
    try{
      await api('/api/company/payments/request', {method:'POST', body: JSON.stringify({reference})});
      $('payment-reference').value = '';
      $('payment-request-msg').innerHTML = '<div class="admin-row" style="color:#016E51;">Request sent — the platform admin will review it</div>';
      await loadPaymentHistory();
    } catch(e){
      $('payment-request-msg').innerHTML = '<div class="admin-row" style="color:#8C2C20;">Could not send the request</div>';
    } finally {
      $('request-payment-btn').disabled = false;
    }
  });

  function updateAvatarDisplays(){
    const src = currentUser && currentUser.avatarData;
    const preview = $('avatar-preview');
    if (src){
      preview.innerHTML = '<img src="'+src+'" style="width:100%;height:100%;object-fit:cover;">';
    } else {
      preview.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke="var(--ink-soft)" stroke-linecap="round" stroke-linejoin="round" width="28" height="28"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>';
    }
    const brandMark = document.querySelector('.brand-mark');
    if (brandMark){
      brandMark.innerHTML = '<img src="'+(src || LOGO_DATA_URI)+'" style="width:100%;height:100%;object-fit:cover;">';
    }
  }

  $('avatar-pick-btn').addEventListener('click', () => $('avatar-input').click());
  $('avatar-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try{
      const b64 = await fileToBase64(file);
      const data = await api('/api/auth/avatar', {method:'POST', body: JSON.stringify({imageBase64: b64, mediaType: file.type || 'image/jpeg'})});
      currentUser.avatarData = data.avatarData;
      updateAvatarDisplays();
    } catch(err){
      showToast('Could not load the photo', 'error');
    }
  });

  $('change-pass-btn').addEventListener('click', async () => {
    const currentPassword = $('cur-password').value;
    const newPassword = $('new-password').value;
    const msg = $('change-pass-msg');
    msg.innerHTML = '';
    if (!currentPassword || !newPassword){
      msg.innerHTML = '<div class="notice">Fill in both fields</div>';
      return;
    }
    try{
      await api('/api/auth/change-password', {method:'POST', body: JSON.stringify({currentPassword, newPassword})});
      $('cur-password').value=''; $('new-password').value='';
      msg.innerHTML = '<div class="admin-row" style="color:#016E51;">Password changed</div>';
    } catch(e){
      msg.innerHTML = '<div class="notice">Current password is wrong, or the new one is too short</div>';
    }
  });

  // Resume session if a token is already stored
  (async function tryResume(){
    if (!token) return;
    try{
      currentUser = await api('/api/auth/me');
      await enterApp();
    } catch(e){
      logout();
    }
  })();

  // ---- tabs: now handled declaratively by Alpine.js (@click / :class in
  // the HTML) — see x-data="{ activeView: ... }" on #app-screen and
  // #superadmin-screen. Nothing to wire up here anymore.

  $('sa-show-create-btn').addEventListener('click', () => {
    const sec = $('sa-create-section');
    sec.style.display = sec.style.display === 'none' ? 'flex' : 'none';
    if (sec.style.display !== 'none') sec.scrollIntoView({behavior:'smooth', block:'start'});
  });

  // ---- scan flow ----
  const dropzone = $('dropzone'), previewArea = $('preview-area'), previewGrid = $('preview-grid');
  const cameraInput = $('camera-input'), galleryInput = $('gallery-input');
  const statusArea = $('status-area'), formSection = $('form-section'), medList = $('med-list');
  const fDoctor = $('f-doctor'), fPhone = $('f-phone');

  let currentFiles = [];

  $('camera-btn').addEventListener('click', () => cameraInput.click());
  $('gallery-btn').addEventListener('click', () => galleryInput.click());
  $('add-more-btn').addEventListener('click', () => galleryInput.click());
  cameraInput.addEventListener('change', e => addFiles(e.target.files));
  galleryInput.addEventListener('change', e => addFiles(e.target.files));

  function addFiles(fileList){
    if (!fileList || !fileList.length) return;
    currentFiles.push(...Array.from(fileList));
    renderPreviewGrid();
    dropzone.style.display = 'none';
    previewArea.style.display = 'flex';
    statusArea.innerHTML = '';
    cameraInput.value = ''; galleryInput.value = '';
  }

  function renderPreviewGrid(){
    previewGrid.innerHTML = '';
    currentFiles.forEach((file, i) => {
      const div = document.createElement('div');
      div.className = 'preview-thumb';
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        currentFiles.splice(i, 1);
        if (currentFiles.length === 0){
          previewArea.style.display = 'none';
          dropzone.style.display = 'flex';
        } else {
          renderPreviewGrid();
        }
      });
      div.appendChild(img);
      div.appendChild(removeBtn);
      previewGrid.appendChild(div);
    });
  }

  $('retake-btn').addEventListener('click', () => {
    currentFiles = [];
    previewArea.style.display = 'none';
    dropzone.style.display = 'flex';
    statusArea.innerHTML = '';
    cameraInput.value = ''; galleryInput.value = '';
  });

  function setStatus(html){ statusArea.innerHTML = html; }
  function showThinking(){ setStatus('<div class="status-line"><span class="spinner"></span><span>Analyzing, please wait...</span></div>'); }
  function showNotice(text){ setStatus('<div class="notice">'+text+'</div>'); }

  function fileToBase64(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  $('read-btn').addEventListener('click', async () => {
    if (!currentFiles.length) return;
    $('read-btn').disabled = true;
    showThinking();
    try{
      const primary = currentFiles[0];
      const b64 = await fileToBase64(primary);
      const data = await api('/api/scan', {
        method:'POST',
        body: JSON.stringify({ imageBase64: b64, mediaType: primary.type || 'image/jpeg' })
      });
      setStatus('');
      fillForm(data);
    } catch(e){
      showNotice('Could not read the photo. Please try again or enter it manually.');
      fillForm({});
    } finally {
      $('read-btn').disabled = false;
    }
  });

  let itemImageDebounce = null;

  const MED_PLACEHOLDER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke="var(--ink-soft)" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 20.5L3.5 13.5a4.95 4.95 0 117-7l7 7a4.95 4.95 0 11-7 7z"/><path d="M8.5 8.5l7 7"/></svg>';
  const BRANCH_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1M9 13h1M14 9h1M14 13h1"/></svg>';

  function addMedRow(value){
    const card = document.createElement('div');
    card.className = 'med-card';
    card.innerHTML =
      '<div class="med-card-header">'+
        '<div class="med-card-icon">'+MED_PLACEHOLDER_ICON+'</div>'+
        '<div class="med-card-title">'+
          '<input class="med-name-input" type="text" placeholder="Item name" value="'+escapeAttr(value||'')+'">'+
          '<div class="med-card-type"></div>'+
          '<div class="med-photo-caption" style="font-size:11px;color:var(--ink-soft);"></div>'+
        '</div>'+
        '<button type="button" class="icon-btn med-remove-btn"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:8px;">'+
        '<button type="button" class="btn-ghost med-verify-btn" style="padding:6px 12px;font-size:12px;">📷 Verify item photo</button>'+
        '<input type="file" accept="image/*" class="med-verify-input" style="display:none;">'+
      '</div>'+
      '<div class="med-verify-result"></div>'+
      '<div class="med-info-area"></div>';

    card.querySelector('.med-remove-btn').addEventListener('click', () => {
      card.remove();
      updateMedCount();
    });
    const input = card.querySelector('.med-name-input');
    const cardIcon = card.querySelector('.med-card-icon');
    const photoCaption = card.querySelector('.med-photo-caption');
    const infoArea = card.querySelector('.med-info-area');
    const verifyBtn = card.querySelector('.med-verify-btn');
    const verifyInput = card.querySelector('.med-verify-input');
    const verifyResult = card.querySelector('.med-verify-result');

    verifyBtn.addEventListener('click', () => verifyInput.click());
    verifyInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const name = input.value.trim();
      if (!name){
        verifyResult.innerHTML = '<div class="med-info-unavailable">Type the item name first, then verify its photo.</div>';
        verifyInput.value = '';
        return;
      }
      verifyResult.innerHTML = '<div class="med-info-loading"><span class="spinner" style="width:12px;height:12px;"></span>Checking the photo against "'+escapeHtml(name)+'"...</div>';
      try{
        const b64 = await fileToBase64(file);
        const result = await api('/api/medicine-verify-photo', {
          method:'POST',
          body: JSON.stringify({ name, imageBase64: b64, mediaType: file.type || 'image/jpeg' }),
        });
        // Save this photo as the item's remembered photo — organization-wide,
        // so it shows automatically for this item name at every branch from now on.
        try{
          await api('/api/item-image', {
            method:'POST',
            body: JSON.stringify({ name, imageBase64: b64, mediaType: file.type || 'image/jpeg' }),
          });
        } catch(saveErr){}
        const previewUrl = URL.createObjectURL(file);
        cardIcon.innerHTML = '<img src="'+previewUrl+'">';
        photoCaption.textContent = "Saved as this item's photo";
        const previewImg = '<img src="'+previewUrl+'" style="width:34px;height:34px;object-fit:cover;border-radius:6px;border:1px solid var(--line);flex-shrink:0;">';
        if (!result.checked){
          verifyResult.innerHTML = '<div style="display:flex;gap:8px;align-items:center;">'+previewImg+'<span class="med-info-unavailable" style="padding:0;">Could not check the photo right now.</span></div>';
        } else if (result.matches){
          verifyResult.innerHTML = '<div style="display:flex;gap:8px;align-items:flex-start;">'+previewImg+
            '<div><span class="status-badge approved">✓ Looks like a match</span>'+
            (result.note ? '<div class="meta" style="margin-top:3px;">'+escapeHtml(result.note)+'</div>' : '')+
            '</div></div>';
        } else {
          verifyResult.innerHTML = '<div style="display:flex;gap:8px;align-items:flex-start;">'+previewImg+
            '<div><span class="status-badge rejected">⚠ May not match — please double-check</span>'+
            (result.detectedName ? '<div class="meta" style="margin-top:3px;">Photo appears to show: '+escapeHtml(result.detectedName)+'</div>' : '')+
            (result.note ? '<div class="meta">'+escapeHtml(result.note)+'</div>' : '')+
            '</div></div>';
        }
      } catch(e){
        verifyResult.innerHTML = '<div class="med-info-unavailable">Could not check the photo right now.</div>';
      } finally {
        verifyInput.value = '';
      }
    });

    const checkItem = () => {
      const name = input.value.trim();
      cardIcon.innerHTML = MED_PLACEHOLDER_ICON;
      photoCaption.textContent = '';
      infoArea.innerHTML = '';
      card.querySelector('.med-card-type').textContent = '';
      input.style.borderBottom = '';
      const dupWarning = card.querySelector('.med-dup-warning');
      if (dupWarning) dupWarning.remove();
      if (!name) return;
      const isDuplicate = Array.from(medList.querySelectorAll('.med-name-input')).some(el =>
        el !== input && el.value.trim().toLowerCase() === name.toLowerCase()
      );
      if (isDuplicate){
        const warn = document.createElement('div');
        warn.className = 'med-dup-warning';
        warn.style.cssText = 'font-size:11px;color:var(--danger-deep);margin-top:-6px;';
        warn.textContent = 'This item is already in the list';
        card.querySelector('.med-card-title').appendChild(warn);
        input.style.borderBottom = '1.5px solid var(--danger)';
      }
      clearTimeout(itemImageDebounce);
      itemImageDebounce = setTimeout(async () => {
        // remembered photo for this item name
        try{
          const data = await api('/api/item-image?name=' + encodeURIComponent(name));
          if (data.imageData){
            cardIcon.innerHTML = '<img src="'+data.imageData+'">';
            photoCaption.textContent = data.createdByOrgName ? 'Photo added by '+data.createdByOrgName : 'Photo on file';
          }
        } catch(e){}
        // AI reference info
        infoArea.innerHTML = '<div class="med-info-loading"><span class="spinner" style="width:12px;height:12px;"></span>Looking up medicine info...</div>';
        try{
          const info = await api('/api/medicine-info', {method:'POST', body: JSON.stringify({name})});
          if (!info.identified){
            infoArea.innerHTML = '<div class="med-info-unavailable">Medicine information unavailable — please verify the medicine name or review manually.</div>';
            return;
          }
          card.querySelector('.med-card-type').textContent = [info.strength, info.type, info.manufacturer ? 'by '+info.manufacturer : ''].filter(Boolean).join(' · ');
          const importantList = (info.important||[]).map(x=>'<li>'+escapeHtml(x)+'</li>').join('') || '<li>—</li>';
          const sideEffectsList = (info.sideEffects||[]).map(x=>'<li>'+escapeHtml(x)+'</li>').join('') || '<li>—</li>';
          infoArea.innerHTML =
            '<div class="med-info-grid">'+
              '<div class="med-info-item used-for"><div class="mi-head"><div class="mi-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 20.5L3.5 13.5a4.95 4.95 0 117-7l7 7a4.95 4.95 0 11-7 7z"/><path d="M8.5 8.5l7 7"/></svg></div><span class="mi-label">Used for</span></div><div class="mi-value">'+escapeHtml(info.usedFor||'—')+'</div></div>'+
              '<div class="med-info-item active-ingredient"><div class="mi-head"><div class="mi-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg></div><span class="mi-label">Active ingredient</span></div><div class="mi-value">'+escapeHtml(info.activeIngredient||'—')+'</div></div>'+
              '<div class="med-info-item important"><div class="mi-head"><div class="mi-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/></svg></div><span class="mi-label">Important</span></div><ul class="mi-list">'+importantList+'</ul></div>'+
              '<div class="med-info-item side-effects"><div class="mi-head"><div class="mi-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg></div><span class="mi-label">Common side effects</span></div><ul class="mi-list">'+sideEffectsList+'</ul></div>'+
            '</div>';
        } catch(e){
          infoArea.innerHTML = '<div class="med-info-unavailable">Medicine information unavailable — please verify the medicine name or review manually.</div>';
        }
      }, 600);
    };
    input.addEventListener('input', (e) => {
      if (e.inputType && e.inputType.indexOf('insert') === 0){
        const typed = input.value;
        if (typed){
          const match = knownItemNames.find(n =>
            n.toLowerCase().startsWith(typed.toLowerCase()) && n.length > typed.length
          );
          if (match){
            input.value = typed + match.slice(typed.length);
            input.setSelectionRange(typed.length, match.length);
          }
        }
      }
      checkItem();
    });
    medList.appendChild(card);
    updateMedCount();
    if (value) checkItem();
  }

  function updateMedCount(){
    const countEl = $('med-count');
    if (countEl) countEl.textContent = medList.querySelectorAll('.med-card').length;
  }
  function escapeAttr(s){ return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
  function escapeHtml(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function roleLabel(role){
    if (role==='owner') return 'Owner';
    if (role==='company_admin') return 'Company admin';
    if (role==='branch_manager') return 'Branch manager';
    if (role==='viewer') return 'Viewer';
    return 'Employee';
  }

  $('add-med-btn').addEventListener('click', () => addMedRow(''));

  function fillForm(data){
    fDoctor.value = (data && data.doctorName) || '';
    fPhone.value = (data && data.phone) || '';
    $('f-category').value = 'Medicine';
    $('f-source').value = 'Private';
    medList.innerHTML = '';
    const meds = (data && Array.isArray(data.medicines)) ? data.medicines.filter(Boolean) : [];
    if (meds.length === 0) addMedRow(''); else meds.forEach(m => addMedRow(m));
    formSection.style.display = 'flex';
    formSection.scrollIntoView({behavior:'smooth', block:'start'});
  }

  $('save-btn').addEventListener('click', async () => {
    const doctorName = fDoctor.value.trim();
    const phone = fPhone.value.trim();
    const category = $('f-category').value;
    const source = $('f-source').value;
    const medicines = Array.from(medList.querySelectorAll('.med-name-input')).map(i => i.value.trim()).filter(Boolean);
    if (!doctorName && !phone && medicines.length === 0){
      showNotice('Please fill in at least one field before saving.');
      return;
    }
    const seen = new Set();
    const duplicates = new Set();
    medicines.forEach(m => {
      const key = m.toLowerCase();
      if (seen.has(key)) duplicates.add(m);
      seen.add(key);
    });
    if (duplicates.size){
      showNotice('This item is already in the list: '+Array.from(duplicates).join(', ')+'. Please remove the duplicate before saving.');
      return;
    }
    $('save-btn').disabled = true;
    try{
      const body = {doctorName, phone, medicines, category, source};
      if (currentFiles.length){
        body.images = await Promise.all(currentFiles.map(async f => ({
          imageBase64: await fileToBase64(f),
          mediaType: f.type || 'image/jpeg',
        })));
      }
      await api('/api/prescriptions', { method:'POST', body: JSON.stringify(body) });
      showToast('Order saved successfully', 'success');
      formSection.style.display = 'none';
      previewArea.style.display = 'none';
      dropzone.style.display = 'flex';
      currentFiles = [];
      cameraInput.value=''; galleryInput.value='';
      statusArea.innerHTML='';
      await loadHistory();
      loadKnownItemNames();
    } catch(e){
      if (e.body && e.body.error === 'plan_limit_reached'){
        showNotice('Your pharmacy has reached its monthly scan limit ('+e.body.max+'). Ask the platform admin to upgrade your plan.');
      } else if (e.body && e.body.error === 'branch_pending_approval'){
        showNotice('Your branch is still pending approval from the platform admin. Scanning will be enabled once it is approved.');
      } else {
        showNotice('Could not be saved. Please try again.');
      }
    } finally {
      $('save-btn').disabled = false;
    }
  });

  function showToast(message, kind){
    const t = $('toast');
    t.textContent = message || 'Saved';
    t.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---- history ----
  function statusLabel(s){
    if (s==='approved') return 'Approved';
    if (s==='rejected') return 'Rejected';
    return 'Pending';
  }

  let allHistoryRows = [];

  function renderHistoryList(rows){
    const list = $('history-list');
    const canReview = currentUser && ['owner','company_admin','branch_manager'].includes(currentUser.role);
    if (!rows.length){ list.innerHTML = '<div class="empty-hist">No results found</div>'; return; }
    list.innerHTML = '';
    rows.forEach(r => {
      const item = document.createElement('div');
      item.className = 'history-item';
      const dateStr = new Date(r.createdAt).toLocaleDateString('ckb', {year:'numeric', month:'short', day:'numeric'});
      const status = r.status || 'pending';
      const extraMeta = [r.branchName, r.employeeEmail].filter(Boolean).join(' · ');
      item.innerHTML =
        '<div class="history-head"><div class="hh-main">'+
          '<div class="doc">'+escapeHtml(r.doctorName||'No doctor name')+' <span style="font-weight:400;color:var(--ink-soft);">· '+escapeHtml(r.category||'Medicine')+' · '+escapeHtml(r.source||'Private')+'</span></div>'+
          '<div class="meta">'+escapeHtml(dateStr)+' · '+r.medicines.length+' Medicine'+(extraMeta ? ' · '+escapeHtml(extraMeta) : '')+'</div>'+
        '</div>'+
        '<span class="status-badge '+status+'">'+statusLabel(status)+'</span>'+
        '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></div>'+
        '<div class="history-body">'+
          (r.medicines.length ? '<ul>'+r.medicines.map(m=>'<li>'+escapeHtml(m)+'</li>').join('')+'</ul>' : '<p style="font-size:13px;color:var(--ink-soft);margin:10px 0 0;">No items recorded</p>')+
          (r.phone ? '<div style="font-size:13px;color:var(--ink-soft);margin-top:8px;">Number: '+escapeHtml(r.phone)+'</div>' : '')+
          (r.imageCount ? '<button class="add-med" type="button" data-view-image="'+r.id+'" style="margin-top:8px;"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8a2 2 0 012-2h1.5l1-1.5h7l1 1.5H18a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8z"/><circle cx="12" cy="13" r="3.5"/></svg>View photo ('+r.imageCount+')</button><div id="img-'+r.id+'" style="display:none;margin-top:8px;grid-template-columns:repeat(3,1fr);gap:8px;"></div>' : '')+
          '<div class="history-actions" style="justify-content:space-between;">'+
            (canReview && status === 'pending' ?
              '<div><button class="approve-btn" type="button" data-approve="'+r.id+'"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>Approve</button>'+
              '<button class="reject-btn" type="button" data-reject="'+r.id+'"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>Reject</button></div>'
              : '<span></span>')+
            '<button class="del-btn" type="button"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>Delete</button>'+
          '</div>'+
        '</div>';
      item.querySelector('.history-head').addEventListener('click', () => item.classList.toggle('open'));
      item.querySelector('.del-btn').addEventListener('click', async (ev) => {
        ev.stopPropagation();
        try{ await api('/api/prescriptions/'+r.id, {method:'DELETE'}); await loadHistory(); } catch(e){}
      });
      const approveBtn = item.querySelector('[data-approve]');
      if (approveBtn) approveBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        try{ await api('/api/prescriptions/'+r.id+'/approve', {method:'POST'}); await loadHistory(); } catch(e){}
      });
      const rejectBtn = item.querySelector('[data-reject]');
      if (rejectBtn) rejectBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        try{ await api('/api/prescriptions/'+r.id+'/reject', {method:'POST'}); await loadHistory(); } catch(e){}
      });
      const viewImgBtn = item.querySelector('[data-view-image]');
      if (viewImgBtn) viewImgBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const holder = document.getElementById('img-'+r.id);
        if (holder.style.display !== 'none'){ holder.style.display = 'none'; return; }
        holder.style.display = 'grid';
        if (!holder.dataset.loaded){
          try{
            const data = await api('/api/prescriptions/'+r.id+'/images');
            const imgs = data.images || [];
            holder.innerHTML = imgs.length
              ? imgs.map(img => '<img src="'+img.imageData+'" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;border:1px solid var(--line);">').join('')
              : '<div class="empty-hist">No photo</div>';
            holder.dataset.loaded = '1';
          } catch(e){
            holder.innerHTML = '<div class="empty-hist">Could not load the photo</div>';
          }
        }
      });
      list.appendChild(item);
    });
  }

  function filterHistory(term){
    term = term.trim().toLowerCase();
    const branchFilter = $('history-branch-filter').value;
    let rows = allHistoryRows;
    if (branchFilter){
      rows = rows.filter(r => (r.branchName||'') === branchFilter);
    }
    if (!term) return rows;
    return rows.filter(r => {
      const haystack = [
        r.doctorName, r.phone, r.category, r.source, r.branchName, r.employeeEmail,
        ...(r.medicines||[])
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }

  $('history-search').addEventListener('input', (e) => {
    renderHistoryList(filterHistory(e.target.value));
  });
  $('history-branch-filter').addEventListener('change', () => {
    renderHistoryList(filterHistory($('history-search').value));
  });

  function populateHistoryBranchFilter(rows){
    const sel = $('history-branch-filter');
    const current = sel.value;
    const names = Array.from(new Set(rows.map(r => r.branchName).filter(Boolean))).sort();
    sel.innerHTML = '<option value="">All branches</option>' +
      names.map(n => '<option value="'+escapeHtml(n)+'"'+(n===current?' selected':'')+'>'+escapeHtml(n)+'</option>').join('');
  }

  async function loadHistory(){
    const list = $('history-list');
    try{
      const rows = await api('/api/prescriptions');
      allHistoryRows = rows;
      const isOrgReader = currentUser && ['owner','company_admin','viewer'].includes(currentUser.role);
      $('history-branch-filter').style.display = isOrgReader ? 'block' : 'none';
      if (isOrgReader) populateHistoryBranchFilter(rows);
      renderHistoryList(filterHistory($('history-search').value));
    } catch(e){
      list.innerHTML = '<div class="empty-hist">Could not load the list</div>';
    }
  }

  // ---- admin: branches ----
  async function loadBranches(){
    let stats = [];
    try{
      stats = await api('/api/branches/stats');
    } catch(e){
      // fall back to plain list without stats
      const plain = await api('/api/branches');
      stats = plain.map(b => ({ ...b, userCount:0, prescriptionCount:0, scansToday:0, pendingCount:0, approvedCount:0, rejectedCount:0, managerEmail:null }));
    }
    const list = $('branch-list');
    list.innerHTML = stats.map(b => (
      '<div class="branch-card">'+
        '<div class="branch-card-head">'+
          '<div>'+
            '<div class="name"><span class="branch-icon">'+BRANCH_ICON_SVG+'</span>'+escapeHtml(b.name)+'</div>'+
            (b.approved === false ? '<span class="status-badge pending">Pending approval</span>' : '<span class="status-badge approved">Active</span>')+
          '</div>'+
          '<button class="del-btn" data-id="'+b.id+'" title="Delete branch">Delete</button>'+
        '</div>'+
        '<div class="branch-stat-row">'+
          '<div><div class="bs-label">Users</div><div class="bs-value">'+b.userCount+'</div></div>'+
          '<div><div class="bs-label">Prescriptions</div><div class="bs-value">'+b.prescriptionCount+'</div></div>'+
          '<div><div class="bs-label">Scans today</div><div class="bs-value">'+b.scansToday+'</div></div>'+
          '<div><div class="bs-label">Manager</div><div class="bs-value" style="font-size:12.5px;">'+escapeHtml(b.managerEmail||'—')+'</div></div>'+
        '</div>'+
        '<button class="btn-ghost" type="button" data-open-panel="'+b.id+'">Open control panel</button>'+
      '</div>'
    )).join('') || '<div class="empty-hist">No branches</div>';

    list.querySelectorAll('[data-open-panel]').forEach(btn => {
      btn.addEventListener('click', () => openBranchControlPanel(Number(btn.dataset.openPanel), stats));
    });
    list.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        await api('/api/branches/'+btn.dataset.id, {method:'DELETE'});
        await loadBranches();
      });
    });
    const sel = $('new-user-branch');
    sel.innerHTML = stats.map(b => '<option value="'+b.id+'">'+escapeHtml(b.name)+(b.approved === false ? ' (pending)' : '')+'</option>').join('');
  }

  function goToBranchHistory(branchName){
    const tabBtn = $('history-tab-btn');
    if (tabBtn) tabBtn.click();
    const filterSel = $('history-branch-filter');
    if (filterSel){
      filterSel.style.display = 'block';
      if (!Array.from(filterSel.options).some(o => o.value === branchName)){
        filterSel.innerHTML += '<option value="'+escapeHtml(branchName)+'">'+escapeHtml(branchName)+'</option>';
      }
      filterSel.value = branchName;
    }
    renderHistoryList(filterHistory($('history-search').value));
  }

  function openBranchControlPanel(id, stats){
    const b = stats.find(x => x.id === id);
    if (!b) return;
    const panel = $('branch-control-panel');
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.gap = '14px';
    panel.innerHTML =
      '<div class="card" style="gap:14px;">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;">'+
          '<button class="btn-ghost" type="button" id="branch-panel-back">&larr; Back to branches</button>'+
          (b.approved === false ? '<span class="status-badge pending">Pending approval</span>' : '<span class="status-badge approved">Active</span>')+
        '</div>'+
        '<div><div class="page-header" style="margin:0;"><h2 style="font-size:17px;">'+escapeHtml(b.name)+'</h2><p>Branch manager: '+escapeHtml(b.managerEmail||'Not assigned')+'</p></div></div>'+
        '<div class="stat-grid">'+
          statCard("Today's scans", b.scansToday, 'today')+
          statCard('Total prescriptions', b.prescriptionCount, 'total')+
          statCard('Pending review', b.pendingCount, 'today')+
          statCard('Team members', b.userCount, 'users')+
        '</div>'+
        '<div style="display:flex;gap:10px;flex-wrap:wrap;">'+
          '<button class="btn-primary" type="button" id="branch-panel-view-rx">View prescriptions</button>'+
        '</div>'+
      '</div>';
    $('branch-panel-back').addEventListener('click', () => { panel.style.display = 'none'; panel.innerHTML = ''; });
    $('branch-panel-view-rx').addEventListener('click', () => goToBranchHistory(b.name));
    panel.scrollIntoView({behavior:'smooth', block:'start'});
  }

  $('add-branch-btn').addEventListener('click', async () => {
    const name = $('new-branch-name').value.trim();
    if (!name) return;
    try{
      await api('/api/branches', {method:'POST', body: JSON.stringify({name})});
      $('new-branch-name').value = '';
      await loadBranches();
      showToast('Branch added — pending platform admin approval', 'info');
    } catch(e){
      if (e.body && e.body.error === 'plan_limit_reached'){
        showToast('Your plan allows up to '+e.body.max+' branches. Ask the platform admin to upgrade.', 'error');
      } else {
        showToast('Something went wrong', 'error');
      }
    }
  });

  // ---- admin: users ----
  let allUsersCache = [];

  async function loadUsers(){
    allUsersCache = await api('/api/users');
    const branchNames = Array.from(new Set(allUsersCache.map(u => u.branchName).filter(Boolean))).sort();
    const filterSel = $('user-branch-filter');
    const current = filterSel.value;
    filterSel.innerHTML = '<option value="">Select a branch to view its team</option>' +
      branchNames.map(n => '<option value="'+escapeAttr(n)+'"'+(n===current?' selected':'')+'>'+escapeHtml(n)+'</option>').join('');
    renderUserList();
  }

  function renderUserList(){
    const list = $('user-list');
    const branchFilter = $('user-branch-filter').value;
    if (!branchFilter){
      list.innerHTML = '<div class="empty-hist">Select a branch above to view its team</div>';
      return;
    }
    const users = allUsersCache.filter(u => (u.branchName||'') === branchFilter);
    list.innerHTML = users.map(u =>
      '<div class="admin-row"><span>'+escapeHtml(u.email)+'<div class="meta">'+roleLabel(u.role)+' · '+escapeHtml(u.branchName||'No branch')+'</div></span>'+
      '<div style="display:flex;gap:4px;">'+
      '<button class="approve-btn" data-reset="'+u.id+'" type="button">Reset password</button>'+
      '<button class="del-btn" data-id="'+u.id+'">Delete</button>'+
      '</div></div>'+
      '<div class="reset-row" id="reset-row-'+u.id+'" style="display:none;padding:8px 12px;gap:8px;">'+
        '<input type="text" placeholder="New password" id="reset-input-'+u.id+'" style="flex:1;font-family:inherit;font-size:13.5px;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:var(--paper);" dir="ltr">'+
        '<button class="btn-primary" data-confirm-reset="'+u.id+'" style="padding:8px 16px;">Set</button>'+
      '</div>'
    ).join('') || '<div class="empty-hist">No one on this branch\'s team yet</div>';
    list.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await api('/api/users/'+btn.dataset.id, {method:'DELETE'});
        await loadUsers();
      });
    });
    list.querySelectorAll('[data-reset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = document.getElementById('reset-row-'+btn.dataset.reset);
        row.style.display = row.style.display === 'none' ? 'flex' : 'none';
      });
    });
    list.querySelectorAll('[data-confirm-reset]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.confirmReset;
        const input = document.getElementById('reset-input-'+id);
        const val = input.value;
        if (!val || val.length < 4){ showToast('Password must be at least 4 characters', 'error'); return; }
        try{
          await api('/api/users/'+id+'/reset-password', {method:'POST', body: JSON.stringify({newPassword: val})});
          showToast('Password reset', 'success');
          await loadUsers();
        } catch(e){
          showToast('Could not be changed', 'error');
        }
      });
    });
  }

  $('user-branch-filter').addEventListener('change', renderUserList);

  function activityActionLabel(action){
    const map = {
      login: 'Logged in',
      company_registered: 'Company registered',
      branch_created: 'Branch created',
      branch_deleted: 'Branch deleted',
      user_created: 'User created',
      user_deleted: 'User deleted',
      prescription_scanned: 'Prescription scanned',
      prescription_approved: 'Prescription approved',
      prescription_rejected: 'Prescription rejected',
      prescription_deleted: 'Prescription deleted',
      company_created: 'Company created',
      company_status_changed: 'Company status changed',
      company_plan_changed: 'Company plan changed',
      company_deleted: 'Company deleted',
    };
    return map[action] || action;
  }

  async function loadActivityLog(){
    try{
      const logs = await api('/api/activity-logs');
      $('activity-log-list').innerHTML = logs.map(l => {
        const when = new Date(l.createdAt).toLocaleString();
        return '<div class="admin-row" style="flex-direction:column;align-items:stretch;gap:2px;">'+
          '<div style="display:flex;justify-content:space-between;"><b>'+escapeHtml(activityActionLabel(l.action))+'</b><span class="meta">'+escapeHtml(when)+'</span></div>'+
          '<span class="meta">'+escapeHtml(l.userEmail||'—')+(l.details ? ' · '+escapeHtml(l.details) : '')+'</span>'+
        '</div>';
      }).join('') || '<div class="empty-hist">No activity yet</div>';
    } catch(e){
      $('activity-log-list').innerHTML = '<div class="empty-hist">Could not load the activity log</div>';
    }
  }

  $('add-user-btn').addEventListener('click', async () => {
    const email = $('new-user-email').value.trim();
    const password = $('new-user-password').value;
    const role = $('new-user-role').value;
    const branchId = Number($('new-user-branch').value) || null;
    if (!email || !password) return;
    try{
      await api('/api/users', {method:'POST', body: JSON.stringify({email, password, role, branchId})});
      $('new-user-email').value=''; $('new-user-password').value='';
      await loadUsers();
      showToast('User added', 'success');
    } catch(e){
      if (e.body && e.body.error === 'plan_limit_reached'){
        showToast('Your plan allows up to '+e.body.max+' users. Ask the platform admin to upgrade.', 'error');
      } else {
        showToast('That email is already taken, or something went wrong', 'error');
      }
    }
  });

  // ---- reports ----
  function reportRow(name, count){
    return '<div class="admin-row"><span>'+escapeHtml(name)+'</span><span class="meta">'+count+'</span></div>';
  }

  function statCard(label, value, kind){
    const icons = {
      total: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
      today: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
      company: '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1M9 13h1M14 9h1M14 13h1"/>',
      active: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
      users: '<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
      revenue: '<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
    };
    return '<div class="stat-card">'+
      '<div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(icons[kind]||icons.total)+'</svg></div>'+
      '<span class="stat-label">'+escapeHtml(label)+'</span>'+
      '<span class="stat-value">'+value+'</span>'+
    '</div>';
  }

  function renderBarChart(svgId, data, opts){
    opts = opts || {};
    const svg = $(svgId);
    if (!svg) return;
    if (!data.length){ svg.setAttribute('height', 1); svg.innerHTML=''; return; }
    const max = Math.max.apply(null, data.map(d => d.count).concat([1]));
    let html = '';
    if (opts.horizontal){
      const rowH = 24, gap = 8, labelW = 100, chartW = 220;
      const height = data.length*(rowH+gap);
      svg.setAttribute('viewBox', '0 0 380 '+height);
      svg.setAttribute('height', height);
      svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
      data.forEach((d,i) => {
        const y = i*(rowH+gap);
        const barW = Math.max((d.count/max) * chartW, 2);
        html += '<text x="0" y="'+(y+rowH/2+4)+'" font-size="11.5" fill="var(--ink-soft)">'+escapeHtml((d.name||'').slice(0,14))+'</text>';
        html += '<rect x="'+labelW+'" y="'+y+'" width="'+barW+'" height="'+rowH+'" rx="5" fill="var(--amber)"></rect>';
        html += '<text x="'+(labelW+barW+8)+'" y="'+(y+rowH/2+4)+'" font-size="11.5" fill="var(--ink)">'+d.count+'</text>';
      });
    } else {
      const barW = 20, gap = 8, chartH = 100, labelH = 18;
      const width = data.length*(barW+gap);
      svg.setAttribute('viewBox', '0 0 '+width+' '+(chartH+labelH+16));
      svg.setAttribute('height', chartH+labelH+16);
      svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
      data.forEach((d,i) => {
        const x = i*(barW+gap);
        const barH = Math.max((d.count/max) * chartH, 2);
        html += '<rect x="'+x+'" y="'+(chartH-barH)+'" width="'+barW+'" height="'+barH+'" rx="4" fill="var(--amber)"></rect>';
        html += '<text x="'+(x+barW/2)+'" y="'+(chartH+14)+'" font-size="9.5" text-anchor="middle" fill="var(--ink-soft)">'+escapeHtml((d.name||'').slice(5))+'</text>';
        html += '<text x="'+(x+barW/2)+'" y="'+(chartH-barH-4)+'" font-size="9.5" text-anchor="middle" fill="var(--ink)">'+d.count+'</text>';
      });
    }
    svg.innerHTML = html;
  }

  let allDoctorRows = [];

  function renderDoctorList(rows){
    const doctorList = $('report-by-doctor');
    doctorList.innerHTML = rows.map(r =>
      '<div class="admin-row" style="cursor:pointer;" data-doctor="'+escapeAttr(r.name)+'"><span>'+escapeHtml(r.name)+'</span><span class="meta">'+r.count+'</span></div>'
    ).join('') || '<div class="empty-hist">None</div>';
    doctorList.querySelectorAll('[data-doctor]').forEach(row => {
      row.addEventListener('click', () => loadDoctorDetail(row.dataset.doctor));
    });
  }

  $('doctor-search').addEventListener('input', (e) => {
    const term = e.target.value.trim().toLowerCase();
    renderDoctorList(term ? allDoctorRows.filter(r => r.name.toLowerCase().includes(term)) : allDoctorRows);
  });

  async function loadReports(){
    try{
      const data = await api('/api/reports/overview');
      const todayCount = (data.byDay||[]).find(r => r.name === new Date().toISOString().slice(0,10))?.count || 0;
      $('report-total').innerHTML = statCard('Total orders', data.total, 'total') + statCard("Today's scans", todayCount, 'today');
      $('report-by-branch').innerHTML = data.byBranch.map(r => reportRow(r.name, r.count)).join('') || '<div class="empty-hist">None</div>';
      $('report-by-employee').innerHTML = data.byEmployee.map(r => reportRow(r.name, r.count)).join('') || '<div class="empty-hist">None</div>';
      $('report-by-category').innerHTML = (data.byCategory||[]).map(r => reportRow(r.name, r.count)).join('') || '<div class="empty-hist">None</div>';
      renderBarChart('chart-by-category', data.byCategory||[], {horizontal:true});
      $('report-by-source').innerHTML = (data.bySource||[]).map(r => reportRow(r.name, r.count)).join('') || '<div class="empty-hist">None</div>';
      $('report-by-year').innerHTML = (data.byYear||[]).map(r => reportRow(r.name, r.count)).join('') || '<div class="empty-hist">None</div>';
      $('report-by-month').innerHTML = (data.byMonth||[]).map(r => reportRow(r.name, r.count)).join('') || '<div class="empty-hist">None</div>';
      renderBarChart('chart-by-month', (data.byMonth||[]).slice(0,12).reverse(), {horizontal:false});
      $('report-by-day').innerHTML = (data.byDay||[]).slice(0,30).map(r => reportRow(r.name, r.count)).join('') || '<div class="empty-hist">None</div>';
      $('report-top-medicines').innerHTML = data.topMedicines.map(r => reportRow(r.name, r.count)).join('') || '<div class="empty-hist">None</div>';

      allDoctorRows = data.byDoctor;
      renderDoctorList(allDoctorRows);
    } catch(e){
      $('report-total').innerHTML = '<div class="empty-hist">Could not load the report</div>';
    }
  }

  async function loadDoctorDetail(name){
    const section = $('doctor-detail-section');
    const list = $('doctor-detail-list');
    $('doctor-detail-title').textContent = 'Details: ' + name;
    section.style.display = 'flex';
    section.scrollIntoView({behavior:'smooth', block:'start'});
    try{
      const data = await api('/api/reports/doctor?name=' + encodeURIComponent(name));
      if (!data.prescriptions.length){ list.innerHTML = '<div class="empty-hist">No orders</div>'; return; }
      list.innerHTML = data.prescriptions.map(p => {
        const dateStr = new Date(p.createdAt).toLocaleDateString('ckb', {year:'numeric', month:'short', day:'numeric'});
        return '<div class="admin-row" style="align-items:flex-start;flex-direction:column;gap:4px;">'+
          '<span>'+escapeHtml(p.branchName||'—')+' · '+escapeHtml(p.employeeEmail||'—')+' · '+escapeHtml(p.category||'Medicine')+' · '+escapeHtml(p.source||'Private')+' · '+escapeHtml(dateStr)+'</span>'+
          '<span class="meta">'+(p.medicines.length ? escapeHtml(p.medicines.join(', ')) : 'No items recorded')+'</span>'+
        '</div>';
      }).join('');
    } catch(e){
      list.innerHTML = '<div class="empty-hist">Could not be loaded</div>';
    }
  }
})();
