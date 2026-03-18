// Store Class for LocalStorage Logic
class AppStore {
    constructor() {
        this.items = JSON.parse(localStorage.getItem('apex_items')) || [];
        this.categories = JSON.parse(localStorage.getItem('apex_categories')) || ['PC', 'VR', 'Périphérique'];
        
        // Populate specific dummy data if empty
        if (this.items.length === 0) {
            this.items = [
                { id: Date.now().toString(), name: "Meta Quest 3", code: "VR-001", category: "VR", state: "dispo", borrowInfo: null },
                { id: (Date.now() + 1).toString(), name: "MacBook Pro 16", code: "PC-012", category: "PC", state: "emprunte", borrowInfo: { firstName: "Nikos", lastName: "Unilasalle", date: "2026-03-30", reason: "Projet Fin d'études" } },
                { id: (Date.now() + 2).toString(), name: "Câble HDMI 10m", code: "PER-005", category: "Périphérique", state: "non_empruntable", borrowInfo: null },
                { id: (Date.now() + 3).toString(), name: "Camera Sony", code: "CAM-001", category: "Périphérique", state: "HS", borrowInfo: null }
            ];
            this.save();
        }
    }

    save() {
        localStorage.setItem('apex_items', JSON.stringify(this.items));
        localStorage.setItem('apex_categories', JSON.stringify(this.categories));
    }

    addItem(item) {
        this.items.unshift(item); // Add at beginning
        this.save();
    }

    addCategory(cat) {
        if (!this.categories.includes(cat)) {
            this.categories.push(cat);
            this.save();
        }
    }

    updateStates(ids, newState, borrowInfo = null) {
        this.items = this.items.map(item => {
            if (ids.includes(item.id)) {
                item.state = newState;
                item.borrowInfo = borrowInfo;
            }
            return item;
        });
        this.save();
    }
}

// UI Controller
document.addEventListener('DOMContentLoaded', () => {
    // -- AUTHENTICATION LOGIC --
    const loginOverlay = document.getElementById('loginOverlay');
    const loginForm = document.getElementById('loginForm');
    const loginPassword = document.getElementById('loginPassword');
    const loginError = document.getElementById('loginError');

    if (localStorage.getItem('apex_auth') === 'true') {
        loginOverlay.classList.add('hidden');
    } else {
        loginPassword.focus();
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (loginPassword.value === 'matos42') {
            localStorage.setItem('apex_auth', 'true');
            loginOverlay.classList.add('hidden');
            loginError.style.display = 'none';
        } else {
            loginError.style.display = 'block';
            loginPassword.value = '';
            loginPassword.focus();
        }
    });

    const store = new AppStore();
    let selectedIds = new Set();
    let currentFilter = 'all';

    // DOM Elements
    const grid = document.getElementById('inventoryGrid');
    const searchInput = document.getElementById('searchInput');
    const categoryChips = document.getElementById('categoryChips');
    let selectedCategories = new Set();
    const selectionBar = document.getElementById('selectionBar');
    const selectionCount = document.getElementById('selectionCount');
    
    // Modals
    const modalAdd = document.getElementById('modalAdd');
    const modalBorrow = document.getElementById('modalBorrow');

    // Add New Modal Elements
    const btnAddNew = document.getElementById('btnAddNew');
    const formAdd = document.getElementById('formAdd');
    const addCatSelector = document.getElementById('addCategorySelector');
    const btnNewDocCat = document.getElementById('btnNewDocCat');
    const addNewCategory = document.getElementById('addNewCategory');

    // Borrow / Return Elements
    const btnBorrowSelected = document.getElementById('btnBorrowSelected');
    const formBorrow = document.getElementById('formBorrow');
    const borrowCountLabel = document.getElementById('borrowCountLabel');
    const btnReturnSelected = document.getElementById('btnReturnSelected');

    // Context Menu
    const contextMenu = document.getElementById('contextMenu');
    let rightClickedItemId = null;

    // Init App
    renderGrid();
    updateCategorySelectors();

    // -- NAVIGATION --
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            nav.classList.add('active');
            
            const view = nav.dataset.view;
            if (view === 'inventory') {
                currentFilter = 'all';
            } else if (view === 'loans') {
                currentFilter = 'emprunte';
            } else {
                currentFilter = 'all';
            }
            
            selectedIds.clear();
            updateSelectionBar();
            renderGrid(searchInput.value);
        });
    });

    // -- RENDERING --
    function getStatusConfig(state) {
        const conf = {
            'dispo': { text: 'Disponible', class: 'status-dispo' },
            'HS': { text: 'Hors Service', class: 'status-HS' },
            'emprunte': { text: 'Emprunté', class: 'status-emprunte' },
            'non_empruntable': { text: 'Non Empruntable', class: 'status-non_empruntable' }
        };
        return conf[state];
    }

    function renderGrid(query = '') {
        grid.innerHTML = '';
        const lowerQuery = query.toLowerCase();
        
        let filtered = store.items.filter(i => 
            (i.name.toLowerCase().includes(lowerQuery) || i.code.toLowerCase().includes(lowerQuery))
        );

        if (selectedCategories.size > 0) {
            filtered = filtered.filter(i => selectedCategories.has(i.category));
        }

        if (currentFilter === 'emprunte') {
            filtered = filtered.filter(i => i.state === 'emprunte');
        }

        if (filtered.length === 0) {
            grid.innerHTML = `<div style="text-align:center; grid-column: 1/-1; color: var(--text-secondary); padding: 40px;">Aucun élément trouvé.</div>`;
            return;
        }

        filtered.forEach(item => {
            const card = document.createElement('div');
            card.className = `item-card glass-panel ${selectedIds.has(item.id) ? 'selected' : ''}`;
            card.dataset.id = item.id;
            
            const conf = getStatusConfig(item.state);
            
            let borrowHTML = '';
            if (item.state === 'emprunte' && item.borrowInfo) {
                borrowHTML = `
                    <div class="borrow-info">
                        Emprunté par <strong>${item.borrowInfo.firstName} ${item.borrowInfo.lastName}</strong><br>
                        Retour: <strong>${item.borrowInfo.date}</strong>
                        ${item.borrowInfo.reason ? `<br><span style="opacity: 0.8; font-size: 0.8rem;">${item.borrowInfo.reason}</span>` : ''}
                    </div>`;
            }

            card.innerHTML = `
                <div class="item-header">
                    <span class="item-category">${item.category}</span>
                </div>
                <div class="item-title">${item.name}</div>
                <div class="item-code">${item.code}</div>
                <div class="item-status ${conf.class}">
                    <div class="status-dot"></div> ${conf.text}
                </div>
                ${borrowHTML}
            `;

            // Setup click logic
            card.addEventListener('click', () => {
                // Focus: Borrowed items can be returned. Dispo items can be borrowed.
                if (item.state === 'dispo' || item.state === 'emprunte') {
                    if (selectedIds.has(item.id)) {
                        selectedIds.delete(item.id);
                        card.classList.remove('selected');
                    } else {
                        // Prevent mixing states in selection
                        const hasOtherStates = Array.from(selectedIds).some(id => store.items.find(i => i.id === id).state !== item.state);
                        if(hasOtherStates) {
                            alert("Veuillez sélectionner uniquement des éléments du même statut (tous dispos ou tous empruntés) pour l'action groupée.");
                            return;
                        }
                        selectedIds.add(item.id);
                        card.classList.add('selected');
                    }
                    updateSelectionBar();
                }
            });

            // Right Click Logic
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                rightClickedItemId = item.id;
                
                contextMenu.style.left = `${e.clientX}px`;
                contextMenu.style.top = `${e.clientY}px`;
                contextMenu.classList.remove('hidden');
                
                // Adjust if menu goes outside viewport
                const rect = contextMenu.getBoundingClientRect();
                if (rect.right > window.innerWidth) contextMenu.style.left = `${window.innerWidth - rect.width - 10}px`;
                if (rect.bottom > window.innerHeight) contextMenu.style.top = `${window.innerHeight - rect.height - 10}px`;
            });

            grid.appendChild(card);
        });
    }

    function updateSelectionBar() {
        const btnBorrowSelected = document.getElementById('btnBorrowSelected');
        const btnReturnSelected = document.getElementById('btnReturnSelected');

        if (selectedIds.size > 0) {
            selectionBar.classList.add('active');
            selectionCount.textContent = `${selectedIds.size} élément(s) sélectionné(s)`;
            
            // Check state of first to show correct buttons
            const sampleId = Array.from(selectedIds)[0];
            const sampleItem = store.items.find(i => i.id === sampleId);
            
            if (sampleItem.state === 'dispo') {
                btnBorrowSelected.style.display = 'flex';
                btnReturnSelected.style.display = 'none';
            } else if (sampleItem.state === 'emprunte') {
                btnBorrowSelected.style.display = 'none';
                btnReturnSelected.style.display = 'flex';
            } else {
                btnBorrowSelected.style.display = 'none';
                btnReturnSelected.style.display = 'none';
            }
        } else {
            selectionBar.classList.remove('active');
        }
    }

    // -- ADD NEW LOGIC --
    function updateCategorySelectors() {
        addCatSelector.innerHTML = '';
        store.categories.forEach(cat => {
            let op = document.createElement('option');
            op.value = cat;
            op.textContent = cat;
            addCatSelector.appendChild(op);
        });

        // Update chips
        categoryChips.innerHTML = '';
        
        const allChip = document.createElement('div');
        allChip.className = `chip ${selectedCategories.size === 0 ? 'active' : ''}`;
        allChip.textContent = 'Toutes';
        allChip.addEventListener('click', () => {
            selectedCategories.clear();
            updateChipsUI();
            renderGrid(searchInput.value);
        });
        categoryChips.appendChild(allChip);

        store.categories.forEach(cat => {
            const chip = document.createElement('div');
            chip.className = `chip ${selectedCategories.has(cat) ? 'active' : ''}`;
            chip.textContent = cat;
            chip.addEventListener('click', () => {
                if (selectedCategories.has(cat)) selectedCategories.delete(cat);
                else selectedCategories.add(cat);
                updateChipsUI();
                renderGrid(searchInput.value);
            });
            categoryChips.appendChild(chip);
        });
    }

    function updateChipsUI() {
        if (!categoryChips) return;
        const chips = categoryChips.children;
        if (chips.length === 0) return;
        
        if (selectedCategories.size === 0) {
            chips[0].classList.add('active');
            for(let i=1; i<chips.length; i++) chips[i].classList.remove('active');
        } else {
            chips[0].classList.remove('active');
            for(let i=1; i<chips.length; i++) {
                const cat = chips[i].textContent;
                if (selectedCategories.has(cat)) chips[i].classList.add('active');
                else chips[i].classList.remove('active');
            }
        }
    }

    btnAddNew.addEventListener('click', () => {
        document.getElementById('addName').focus();
        modalAdd.classList.add('active');
    });
    
    btnNewDocCat.addEventListener('click', () => {
        addCatSelector.classList.toggle('hidden');
        addNewCategory.classList.toggle('hidden');
        if(!addNewCategory.classList.contains('hidden')) {
            addNewCategory.focus();
        }
    });

    formAdd.addEventListener('submit', (e) => {
        e.preventDefault();
        
        let category = addCatSelector.value;
        if (!addNewCategory.classList.contains('hidden')) {
            category = addNewCategory.value.trim();
            if(category) {
                store.addCategory(category);
                updateCategorySelectors();
            }
        }

        const quantity = parseInt(document.getElementById('addQuantity').value, 10) || 1;
        const baseName = document.getElementById('addName').value;
        const baseCode = document.getElementById('addCode').value;
        const state = document.getElementById('addState').value;
        
        for (let i = 0; i < quantity; i++) {
            const suffix = quantity > 1 ? `-${i+1}` : '';
            const newItem = {
                id: Date.now().toString() + '-' + i,
                name: quantity > 1 ? `${baseName} ${i+1}` : baseName,
                code: `${baseCode}${suffix}`,
                category: category,
                state: state,
                borrowInfo: null
            };
            store.addItem(newItem);
        }
        modalAdd.classList.remove('active');
        formAdd.reset();
        
        // Reset category ui
        addCatSelector.classList.remove('hidden');
        addNewCategory.classList.add('hidden');
        
        // If borrowed view is active, new items won't show. Let's switch to inventory.
        if (currentFilter !== 'all') {
            document.querySelector('[data-view="inventory"]').click();
        } else {
            renderGrid(searchInput.value);
        }
    });

    // -- BORROW LOGIC --
    btnBorrowSelected.addEventListener('click', () => {
        borrowCountLabel.textContent = selectedIds.size;
        
        // Set default date to today + 7 days
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 7);
        document.getElementById('borrowReturnDate').valueAsDate = targetDate;
        
        modalBorrow.classList.add('active');
        document.getElementById('borrowFirstName').focus();
    });

    formBorrow.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const info = {
            firstName: document.getElementById('borrowFirstName').value,
            lastName: document.getElementById('borrowLastName').value,
            date: document.getElementById('borrowReturnDate').value,
            reason: document.getElementById('borrowReason').value
        };

        store.updateStates(Array.from(selectedIds), 'emprunte', info);
        selectedIds.clear();
        
        modalBorrow.classList.remove('active');
        formBorrow.reset();
        
        updateSelectionBar();
        renderGrid(searchInput.value);
    });

    // -- RETURN LOGIC --
    btnReturnSelected.addEventListener('click', () => {
        if(confirm(`Êtes-vous sûr de notifier le retour de ces ${selectedIds.size} matériel(s) et les rendre de nouveau Disponibles ?`)) {
            store.updateStates(Array.from(selectedIds), 'dispo', null);
            selectedIds.clear();
            updateSelectionBar();
            renderGrid(searchInput.value);
        }
    });

    // -- SEARCH & UTILS --
    searchInput.addEventListener('input', (e) => renderGrid(e.target.value));
    
    document.getElementById('btnClearSelection').addEventListener('click', () => {
        selectedIds.clear();
        renderGrid(searchInput.value);
        updateSelectionBar();
    });

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modalAdd.classList.remove('active');
            modalBorrow.classList.remove('active');
        });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if(e.target === overlay) {
                modalAdd.classList.remove('active');
                modalBorrow.classList.remove('active');
            }
        });
    });

    // -- CONTEXT MENU EVENTS --
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.classList.add('hidden');
        }
    });

    contextMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const actionItem = e.target.closest('.menu-item');
        if (!actionItem || !rightClickedItemId) return;
        
        const action = actionItem.dataset.action;
        
        if (action === 'delete') {
            if(confirm('Êtes-vous sûr de vouloir supprimer définitivement ce matériel ?')) {
                store.items = store.items.filter(i => i.id !== rightClickedItemId);
                store.save();
                selectedIds.delete(rightClickedItemId);
                updateSelectionBar();
                renderGrid(searchInput.value);
            }
        } else if (action.startsWith('state-')) {
            const newState = action.split('state-')[1];
            store.updateStates([rightClickedItemId], newState, null);
            selectedIds.delete(rightClickedItemId);
            updateSelectionBar();
            renderGrid(searchInput.value);
        }
        
        contextMenu.classList.add('hidden');
    });
});
