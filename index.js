    // Main React Application
    // Auction Platform DApp – Pure Event-driven React (NO hooks, NO polling)
    // University Assignment Compliant

    // React 18 createRoot API
    const root = ReactDOM.createRoot(document.getElementById('root'));

    // =======================
    // GLOBAL APPLICATION STATE
    // =======================
    const appState = {
        // Connection state
        isConnected: false,
        account: null,
        balance: '0',
        
        // Contract state
        contractInfo: null,
        contractAddress: '0xb107624FeA00a98732AC00c3758508970CC24192',
        
        // Auction data
        activeAuctions: [],
        fulfilledAuctions: [],
        canceledAuctions: [],
        
        // User state
        pendingReturns: '0',
        isOwner: false,
        isPermanentOwner: false,
        isOwnerOrPermanent: false,
        isBanned: false,
        
        // Contract destroyed state (MANDATORY per spec F)
        isDestroyed: false,
        
        // UI state
        loading: false,
        error: null,
        success: null
    };

    // =======================
    // STATE UPDATE + RENDER
    // =======================
    let _batchUpdate = false;

    const updateUI = (updates = {}) => {
        Object.assign(appState, updates);
        if (!_batchUpdate) {
            renderApp();
        }
    };

    const showError = (msg) => {
        updateUI({ error: msg, success: null });
    };

    const showSuccess = (msg) => {
        updateUI({ success: msg, error: null });
    };

    const clearMessages = () => {
        updateUI({ error: null, success: null });
    };

    // =======================
    // WALLET & CONTRACT SETUP
    // GUARD: No contract interaction before wallet connection
    // =======================
    const connectWallet = async () => {
        // Clear any previous errors
        updateUI({ loading: true, error: null, success: null });

        try {
            // STEP 1: Initialize Web3 and connect wallet FIRST
            const connected = await Web3Integration.init();
            if (!connected) {
                throw new Error('MetaMask connection failed');
            }

            // Verify account is available
            if (!Web3Integration.account) {
                throw new Error('No account available');
            }

            // STEP 2: Check and switch network SECOND
            if (!Web3Integration.isCorrectNetwork()) {
                const switched = await Web3Integration.switchToSepolia();
                if (!switched) {
                    throw new Error('Wrong network - please switch to Sepolia');
                }
            }

            // STEP 3: Initialize contract ONLY AFTER wallet connected and network verified
            await ContractManager.init(appState.contractAddress);
            
            // STEP 4: Setup event listeners AFTER contract initialized
            setupContractEventListeners();
            
            // STEP 5: Load initial data AFTER everything is ready
            await loadInitialData();

            // MetaMask account change handler (EVENT-DRIVEN per spec I)
            Web3Integration.onAccountChange = async (newAccount) => {
                if (!newAccount) {
                    handleDisconnect();
                    return;
                }

                // Suppress renders during reset+reload
                _batchUpdate = true;

                // Hard reset ALL role and data state (no render)
                Object.assign(appState, {
                    account: null,
                    balance: '0',
                    contractInfo: null,
                    activeAuctions: [],
                    fulfilledAuctions: [],
                    canceledAuctions: [],
                    isOwner: false,
                    isPermanentOwner: false,
                    isOwnerOrPermanent: false,
                    isDestroyed: false,
                    pendingReturns: '0',
                    isBanned: false,
                    error: null,
                    success: null
                });

                // Reset contract manager internal state
                ContractManager.reset();

                // Update Web3 with new account
                Web3Integration.account = newAccount;
                Web3Integration.isConnected = true;
                Web3Integration.networkId = await Web3Integration.web3.eth.net.getId();

                if (!Web3Integration.isCorrectNetwork()) {
                    await Web3Integration.switchToSepolia();
                    Web3Integration.networkId = await Web3Integration.web3.eth.net.getId();
                }

                // Re-initialize contract with new account context
                await ContractManager.init(appState.contractAddress);
                setupContractEventListeners();

                // Reload all data (roles recomputed from scratch in loadContractInfo)
                await loadInitialData();

                // Mark connected
                appState.isConnected = true;
                appState.account = newAccount;

                // Single render at the end
                _batchUpdate = false;
                renderApp();
            };

            // MetaMask disconnect handler (EVENT-DRIVEN per spec I)
            Web3Integration.onDisconnect = () => {
                handleDisconnect();
            };

            // Clear errors and mark as connected
            updateUI({ isConnected: true, loading: false, error: null });
            showSuccess('Wallet connected successfully');

        } catch (err) {
            console.error('Connection error:', err);
            // Reset contract state on error
            ContractManager.reset();
            showError(err.message);
            updateUI({ isConnected: false });
        } finally {
            updateUI({ loading: false });
        }
    };

    // Handle disconnect - reset all state
    const handleDisconnect = () => {
        // Reset contract manager
        ContractManager.reset();
        
        // Reset app state
        updateUI({
            isConnected: false,
            account: null,
            balance: '0',
            contractInfo: null,
            activeAuctions: [],
            fulfilledAuctions: [],
            canceledAuctions: [],
            isOwner: false,
            isPermanentOwner: false,
            isOwnerOrPermanent: false,
            isDestroyed: false,
            pendingReturns: '0',
            isBanned: false
        });
    };

    // =======================
    // CONTRACT EVENTS (MANDATORY per spec I - Event-driven state)
    // =======================
    const setupContractEventListeners = () => {
        // AuctionCreated: fee changes balance + totalRevenue
        ContractManager.onAuctionCreated = async () => {
            await loadContractInfo();
            await loadActiveAuctions();
            showSuccess('Auction created');
        };

        // BidPlaced: ETH received changes balance
        ContractManager.onBidPlaced = async () => {
            await loadContractInfo();
            await loadActiveAuctions();
            await loadUserData();
            showSuccess('Bid placed');
        };

        // AuctionCanceled: pendingReturns change
        ContractManager.onAuctionCanceled = async () => {
            await loadContractInfo();
            await loadActiveAuctions();
            await loadCanceledAuctions();
            await loadUserData();
            showSuccess('Auction canceled');
        };

        // AuctionFulfilled: 80% to seller, 20% to revenue, balance changes
        ContractManager.onAuctionFulfilled = async () => {
            await loadContractInfo();
            await loadActiveAuctions();
            await loadFulfilledAuctions();
            await loadUserData();
            showSuccess('Auction fulfilled');
        };

        // ClaimExecuted: balance decreases
        ContractManager.onClaimExecuted = async () => {
            await loadContractInfo();
            await loadUserData();
            showSuccess('Claim executed - funds transferred');
        };

        // WithdrawExecuted: revenue + balance decrease
        ContractManager.onWithdrawExecuted = async () => {
            await loadContractInfo();
            await loadUserData();
            showSuccess('Withdraw executed');
        };

        // SellerBanned: auctions canceled, pendingReturns change
        ContractManager.onSellerBanned = async () => {
            await loadContractInfo();
            await loadActiveAuctions();
            await loadCanceledAuctions();
            await loadUserData();
            showSuccess('Seller banned - auctions canceled');
        };

        // ContractDestroyed: all canceled, revenue transferred to owner
        ContractManager.onContractDestroyed = async () => {
            await loadContractInfo();
            await loadActiveAuctions();
            await loadCanceledAuctions();
            await loadUserData();
            showSuccess('Contract destroyed - only Claim is available');
        };

        // OwnerChanged: owner address changes
        ContractManager.onOwnerChanged = async () => {
            await loadContractInfo();
            showSuccess('Owner changed');
        };
    };

    // =======================
    // DATA LOADERS - ALL GUARDED
    // GUARD: No calls before wallet connection
    // =======================

    // Check if safe to make contract calls
    const isWalletReady = () => {
        return Web3Integration.isConnected && Web3Integration.account && ContractManager.isInitialized;
    };

    const loadInitialData = async () => {
        if (!isWalletReady()) return;

        // STRICT ORDER: roles MUST be computed before any render-relevant data loads
        await loadContractInfo();
        await loadUserData();
        await Promise.all([
            loadActiveAuctions(),
            loadFulfilledAuctions(),
            loadCanceledAuctions()
        ]);
    };

    const loadUserData = async () => {
        // GUARD: Must be connected with valid account
        if (!Web3Integration.isConnected || !Web3Integration.account) {
            return;
        }
        
        // GUARD: Contract must be initialized
        if (!ContractManager.isInitialized) {
            return;
        }
        
        // Roles are NOT fetched here — they come ONLY from loadContractInfo()
        const [balance, pendingReturns, isBanned] = await Promise.all([
            Web3Integration.getBalance(Web3Integration.account),
            ContractManager.getPendingReturns(),
            ContractManager.isBanned()
        ]);

        updateUI({
            account: Web3Integration.account,
            balance,
            pendingReturns,
            isBanned
        });
    };

    const loadContractInfo = async () => {
        // GUARD: Must be connected with valid account
        if (!Web3Integration.isConnected || !Web3Integration.account) {
            return;
        }
        
        // GUARD: Contract must be initialized
        if (!ContractManager.isInitialized) {
            return;
        }
        
        const info = await ContractManager.getContractInfo();
        const account = Web3Integration.account.toLowerCase();
        const isOwner = info.owner.toLowerCase() === account;
        const isPermanentOwner = info.permanentOwner.toLowerCase() === account;
        
        updateUI({
            contractInfo: info,
            isOwner,
            isPermanentOwner,
            isOwnerOrPermanent: isOwner || isPermanentOwner,
            isDestroyed: info.destroyed
        });
    };

    const loadActiveAuctions = async () => {
        if (!isWalletReady()) return;
        
        const ids = await ContractManager.getActiveAuctions();
        const auctions = await Promise.all(ids.map(async id => ({
            ...(await ContractManager.getAuction(id)),
            id
        })));
        updateUI({ activeAuctions: auctions });
    };

    const loadFulfilledAuctions = async () => {
        if (!isWalletReady()) return;
        
        const ids = await ContractManager.getFulfilledAuctions();
        const auctions = await Promise.all(ids.map(async id => ({
            ...(await ContractManager.getAuction(id)),
            id
        })));
        updateUI({ fulfilledAuctions: auctions });
    };

    const loadCanceledAuctions = async () => {
        if (!isWalletReady()) return;
        
        const ids = await ContractManager.getCanceledAuctions();
        const auctions = await Promise.all(ids.map(async id => ({
            ...(await ContractManager.getAuction(id)),
            id
        })));
        updateUI({ canceledAuctions: auctions });
    };

    // =======================
    // USER ACTIONS
    // =======================
    const createAuction = async (description, startPrice, durationHours) => {
        if (appState.isDestroyed) return;
        updateUI({ loading: true });
        try {
            // Pass raw hours — ContractManager converts to seconds
            await ContractManager.createAuction(description, startPrice, durationHours);
        } catch (err) {
            showError(err.message);
        }
        updateUI({ loading: false });
    };

    const placeBid = async (id, amount) => {
        if (appState.isDestroyed) return;
        updateUI({ loading: true });
        try {
            await ContractManager.placeBid(id, amount);
        } catch (err) {
            showError(err.message);
        }
        updateUI({ loading: false });
    };

    const cancelAuction = async (id, reason) => {
        if (appState.isDestroyed) return;
        updateUI({ loading: true });
        try {
            await ContractManager.cancelAuction(id, reason);
        } catch (err) {
            showError(err.message);
        }
        updateUI({ loading: false });
    };

    const fulfillAuction = async (id) => {
        if (appState.isDestroyed) return;
        updateUI({ loading: true });
        try {
            await ContractManager.fulfillAuction(id);
        } catch (err) {
            showError(err.message);
        }
        updateUI({ loading: false });
    };

    // CLAIM function (MANDATORY per spec G)
    // Single global button that claims ALL pending returns
    const claim = async () => {
        updateUI({ loading: true });
        try {
            await ContractManager.claim();
        } catch (err) {
            showError(err.message);
        }
        updateUI({ loading: false });
    };

    // OWNER ACTIONS
    const withdraw = async () => {
        if (appState.isDestroyed) return;
        updateUI({ loading: true });
        try {
            await ContractManager.withdraw();
        } catch (err) {
            showError(err.message);
        }
        updateUI({ loading: false });
    };

    const banSeller = async (sellerAddress) => {
        if (appState.isDestroyed) return;
        updateUI({ loading: true });
        try {
            await ContractManager.banSeller(sellerAddress);
        } catch (err) {
            showError(err.message);
        }
        updateUI({ loading: false });
    };

    const destroyContract = async () => {
        if (appState.isDestroyed) return;
        updateUI({ loading: true });
        try {
            await ContractManager.destroy();
        } catch (err) {
            showError(err.message);
        }
        updateUI({ loading: false });
    };

    const changeOwner = async (newOwner) => {
    if (appState.isDestroyed) return;
    updateUI({ loading: true });
    try {
        await ContractManager.changeOwner(newOwner);
    } catch (err) {
        showError(err.message);
    }
    updateUI({ loading: false });
};


    // =======================
    // UI HELPERS
    // =======================
    const formatRemaining = (end) => {
        const r = end - Math.floor(Date.now() / 1000);
        if (r <= 0) return 'Ended';
        const h = Math.floor(r / 3600);
        const m = Math.floor((r % 3600) / 60);
        return `${h}h ${m}m`;
    };

    const formatAddress = (addr) => {
        if (!addr) return '';
        return addr.slice(0, 6) + '...' + addr.slice(-4);
    };

    // Check if claim button should be enabled (MANDATORY per spec G)
    const canClaim = () => {
        return parseFloat(appState.pendingReturns) > 0;
    };

    // Check if user can create auction (MANDATORY per spec H)
    const canCreateAuction = () => {
        return !appState.isDestroyed && !appState.isOwner && !appState.isPermanentOwner && !appState.isBanned;
    };

    // =======================
    // RENDER COMPONENTS
    // =======================

    // Wallet Info Component (Spec Section 1: Current Address, Owner Address, Balance, Collected fees)
    const renderWalletInfo = () => {
        const info = appState.contractInfo;
        return React.createElement('div', { className: 'wallet-info' },
            React.createElement('div', { className: 'info-row' },
                React.createElement('strong', null, 'Current Address'),
                React.createElement('span', { className: 'info-value' }, appState.account || '')
            ),
            React.createElement('div', { className: 'info-row' },
                React.createElement('strong', null, "Owner's Address"),
                React.createElement('span', { className: 'info-value' }, info ? info.owner : '')
            ),
            React.createElement('div', { className: 'info-row' },
                React.createElement('strong', null, 'Balance'),
                React.createElement('span', { className: 'info-value' }, info ? parseFloat(info.balance).toFixed(4) : '0')
            ),
            React.createElement('div', { className: 'info-row' },
                React.createElement('strong', null, 'Collected fees'),
                React.createElement('span', { className: 'info-value' }, info ? parseFloat(info.totalRevenue).toFixed(4) : '0')
            )
        );
    };

    // Create Auction Form Component (Spec Section 2: New auction)
    // Show form for ALL users; Create button disabled for owner per spec
    const renderCreateAuctionForm = () => {
        const isOwnerOrPerm = appState.isOwner || appState.isPermanentOwner;
        const isDisabled = appState.isDestroyed || appState.loading || appState.isBanned || isOwnerOrPerm;
        
        return React.createElement('div', { 
            className: 'section',
            style: appState.isDestroyed ? { opacity: 0.5, pointerEvents: 'none' } : {}
        },
            React.createElement('h2', null, 'New auction'),
            React.createElement('div', { className: 'form-row' },
                React.createElement('label', null, 'Title'),
                React.createElement('input', { 
                    type: 'text', 
                    id: 'auction-desc',
                    placeholder: 'Auction ID',
                    disabled: isDisabled
                })
            ),
            React.createElement('div', { className: 'form-row' },
                React.createElement('label', null, 'Initial price'),
                React.createElement('input', { 
                    type: 'number', 
                    id: 'auction-price',
                    placeholder: '0.01',
                    step: '0.01',
                    disabled: isDisabled
                })
            ),
            React.createElement('div', { className: 'form-row' },
                React.createElement('label', null, 'Duration (hours)'),
                React.createElement('input', { 
                    type: 'number', 
                    id: 'auction-duration',
                    placeholder: '24',
                    min: '1',
                    disabled: isDisabled
                })
            ),
            React.createElement('button', { 
                className: 'btn',
                disabled: isDisabled,
                style: isDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : {},
                onClick: () => {
                    const desc = document.getElementById('auction-desc').value;
                    const price = document.getElementById('auction-price').value;
                    const hours = document.getElementById('auction-duration').value;
                    if (desc && price && hours) {
                        createAuction(desc, price, parseInt(hours));
                    }
                }
            }, 'Create')
        );
    };

    // Live Auction Row Component (Spec Section 3: table-like layout)
    // Columns: Seller | Title | Current Price | Time Left | You made it | [bid input] [Bid] [Cancel] [Fulfill]
    const renderLiveAuctionRow = (a) => {
        const isHighestBidder = a.highestBidder && 
            a.highestBidder.toLowerCase() === appState.account?.toLowerCase();
        const isSeller = a.seller && 
            a.seller.toLowerCase() === appState.account?.toLowerCase();
        const isOwnerOrPerm = appState.isOwner || appState.isPermanentOwner;
        const isEnded = a.endTime <= Math.floor(Date.now() / 1000);
        const isDisabled = appState.isDestroyed || appState.loading;
        const currentPrice = a.highestBid > 0 ? a.highestBid : a.startPrice;
        // Fulfill enabled: time expired AND has bids AND (seller or owner)
        const canFulfill = isEnded && a.bidCount > 0 && (isSeller || isOwnerOrPerm);
        // Fulfill button visible but disabled if no bids or not ended
        const showFulfill = isSeller || isOwnerOrPerm;
        const fulfillDisabled = isDisabled || !isEnded || a.bidCount === 0;

        return React.createElement('div', { className: 'auction-row', key: a.id },
            React.createElement('span', { className: 'auction-cell seller-cell' }, a.seller),
            React.createElement('span', { className: 'auction-cell' }, a.description),
            React.createElement('span', { className: 'auction-cell' }, '| ' + currentPrice + ' |'),
            React.createElement('span', { className: 'auction-cell' }, formatRemaining(a.endTime) + ' |'),
            React.createElement('span', { className: 'auction-cell' }, isHighestBidder ? '1' : '0'),
            React.createElement('span', { className: 'auction-cell' }, '|'),
            // Bid input + button (spec says everyone can bid, including seller and owner)
            React.createElement('input', {
                type: 'number',
                className: 'bid-input',
                id: 'bid-' + a.id,
                step: '0.01',
                disabled: isDisabled || isEnded
            }),
            React.createElement('button', {
                className: 'btn btn-success btn-sm',
                disabled: isDisabled || isEnded,
                onClick: () => {
                    const v = document.getElementById('bid-' + a.id).value;
                    if (v) placeBid(a.id, v);
                }
            }, 'Bid'),
            // Cancel button (visible for seller or owner)
            (isSeller || isOwnerOrPerm) && React.createElement('button', {
                className: 'btn btn-danger btn-sm',
                disabled: isDisabled,
                onClick: () => {
                    const reason = prompt('Reason for cancellation:');
                    if (reason) cancelAuction(a.id, reason);
                }
            }, 'Cancel'),
            // Fulfill button (visible for seller or owner, disabled until ended + has bids)
            showFulfill && React.createElement('button', {
                className: 'btn btn-sm',
                disabled: fulfillDisabled,
                style: fulfillDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : {},
                onClick: () => fulfillAuction(a.id)
            }, 'Fulfill')
        );
    };

    // Active Auctions Section (Spec Section 3: Live auctions)
    const renderActiveAuctions = () => {
        return React.createElement('div', { className: 'section' },
            React.createElement('h2', null, 'Live auctions'),
            appState.activeAuctions.length === 0 
                ? React.createElement('div', { className: 'empty-state' }, 'No active auctions')
                : React.createElement('div', null,
                    React.createElement('div', { className: 'auction-row auction-header' },
                        React.createElement('span', { className: 'auction-cell seller-cell' }, 'Seller'),
                        React.createElement('span', { className: 'auction-cell' }, 'Title'),
                        React.createElement('span', { className: 'auction-cell' }, 'Current Price / Time Left / You made it')
                    ),
                    appState.activeAuctions.map(renderLiveAuctionRow)
                )
        );
    };

    // Fulfilled Auction Row (Spec Section 4: simple display)
    const renderFulfilledAuctionRow = (a) => {
        const isHighestBidder = a.highestBidder && 
            a.highestBidder.toLowerCase() === appState.account?.toLowerCase();
        return React.createElement('div', { className: 'auction-row', key: a.id },
            React.createElement('span', { className: 'auction-cell seller-cell' }, a.seller),
            React.createElement('span', { className: 'auction-cell' }, a.description),
            React.createElement('span', { className: 'auction-cell' }, '| ' + (a.highestBid || a.startPrice)),
            React.createElement('span', { className: 'auction-cell' }, '| ' + a.bidCount),
            React.createElement('span', { className: 'auction-cell' }, '| ' + (isHighestBidder ? '1' : '0'))
        );
    };

    // Fulfilled Auctions Section (Spec Section 4)
    const renderFulfilledAuctions = () => {
        return React.createElement('div', { className: 'section' },
            React.createElement('h2', null, 'Fulfilled auctions'),
            appState.fulfilledAuctions.length === 0 
                ? React.createElement('div', { className: 'empty-state' }, 'No fulfilled auctions')
                : React.createElement('div', null,
                    appState.fulfilledAuctions.map(renderFulfilledAuctionRow)
                )
        );
    };

    // Canceled Auction Row (Spec Section 5: simple display)
    const renderCanceledAuctionRow = (a) => {
        return React.createElement('div', { className: 'auction-row', key: a.id },
            React.createElement('span', { className: 'auction-cell seller-cell' }, a.seller),
            React.createElement('span', { className: 'auction-cell' }, a.description)
        );
    };

    // Canceled Auctions Section with Claim button (Spec Section 5)
    const renderCanceledAuctions = () => {
        const claimEnabled = canClaim();
        return React.createElement('div', { className: 'section' },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' } },
                React.createElement('h2', { style: { margin: 0 } }, 'Canceled auctions'),
                React.createElement('button', {
                    className: 'btn btn-success btn-sm',
                    disabled: !claimEnabled || appState.loading,
                    style: !claimEnabled ? { opacity: 0.5, cursor: 'not-allowed' } : {},
                    onClick: claim
                }, 'Claim')
            ),
            appState.canceledAuctions.length === 0
                ? React.createElement('div', { className: 'empty-state' }, 'No canceled auctions')
                : React.createElement('div', null,
                    appState.canceledAuctions.map(renderCanceledAuctionRow)
                )
        );
    };

    // Control Panel (Spec Section 6: owner-only actions with inline inputs)
    const renderAdminPanel = () => {
        // Only show for owner/permanentOwner — uses direct flags
        if (!appState.isOwner && !appState.isPermanentOwner) return null;
        
        const isDisabled = appState.isDestroyed || appState.loading;
        
        return React.createElement('div', { className: 'section' },
            React.createElement('h2', null, 'Control Panel'),
            
            // Withdraw button
            React.createElement('div', { className: 'control-row' },
                React.createElement('button', {
                    className: 'btn btn-sm',
                    disabled: isDisabled,
                    style: isDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : {},
                    onClick: withdraw
                }, 'Withdraw')
            ),

            // Change owner button + inline input
            React.createElement('div', { className: 'control-row' },
                React.createElement('button', {
                    className: 'btn btn-sm',
                    disabled: isDisabled,
                    style: isDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : {},
                    onClick: () => {
                        const addr = document.getElementById('new-owner-addr').value;
                        if (addr) changeOwner(addr);
                    }
                }, 'Change owner'),
                React.createElement('input', {
                    type: 'text',
                    id: 'new-owner-addr',
                    className: 'control-input',
                    placeholder: "Enter new owner's wallet address",
                    disabled: isDisabled
                })
            ),
            
            // Ban seller button + inline input
            React.createElement('div', { className: 'control-row' },
                React.createElement('button', {
                    className: 'btn btn-sm',
                    disabled: isDisabled,
                    style: isDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : {},
                    onClick: () => {
                        const addr = document.getElementById('ban-seller-addr').value;
                        if (addr) banSeller(addr);
                    }
                }, 'Ban seller'),
                React.createElement('input', {
                    type: 'text',
                    id: 'ban-seller-addr',
                    className: 'control-input',
                    placeholder: "Enter seller's address",
                    disabled: isDisabled
                })
            ),
            
            // Destroy contract button
            React.createElement('div', { className: 'control-row' },
                React.createElement('button', {
                    className: 'btn btn-danger btn-sm',
                    disabled: isDisabled,
                    style: isDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : {},
                    onClick: () => destroyContract()
                }, 'Destroy')
            )
        );
    };

    // Contract Destroyed Banner (MANDATORY per spec F)
    const renderDestroyedBanner = () => {
        if (!appState.isDestroyed) return null;
        
        return React.createElement('div', { 
            style: { 
                background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
                color: 'white',
                padding: '20px',
                borderRadius: '15px',
                marginBottom: '25px',
                textAlign: 'center'
            }
        },
            React.createElement('h2', null, '⚠️ CONTRACT DESTROYED ⚠️'),
            React.createElement('p', null, 'All actions are disabled except Claim. Please claim your pending returns.')
        );
    };

    // =======================
    // MAIN RENDER (React 18 createRoot API)
    // =======================
    const renderApp = () => {
        root.render(
            React.createElement('div', { className: 'container' },
                // Header
                React.createElement('div', { className: 'header' },
                    React.createElement('h1', null, 'Auction Platform DApp'),
                    React.createElement('p', null, 'Decentralized eBay-like auction system')
                ),
                
                // Error/Success messages
                appState.error && React.createElement('div', { className: 'error' }, appState.error),
                appState.success && React.createElement('div', { className: 'success' }, appState.success),
                
                // Loading indicator
                appState.loading && React.createElement('div', { className: 'loading' }, 'Processing...'),
                
                // Not connected state
                !appState.isConnected
                    ? React.createElement('div', { style: { textAlign: 'center', padding: '40px' } },
                        React.createElement('p', null, 'Connect your MetaMask wallet to interact with the auction platform.'),
                        React.createElement('button', { 
                            className: 'connect-btn',
                            onClick: connectWallet,
                            disabled: appState.loading
                        }, 'Connect Wallet')
                    )
                    // Connected state (section order per spec: 1-Header, 2-NewAuction, 3-Live, 4-Fulfilled, 5-Canceled+Claim, 6-ControlPanel)
                    : React.createElement(React.Fragment, null,
                        // Destroyed banner (MANDATORY per spec F)
                        renderDestroyedBanner(),
                        
                        // 1. Wallet/contract info header
                        renderWalletInfo(),
                        
                        // 2. New auction form (Create button disabled for owner per spec)
                        renderCreateAuctionForm(),
                        
                        // 3. Live auctions
                        renderActiveAuctions(),
                        
                        // 4. Fulfilled auctions
                        renderFulfilledAuctions(),
                        
                        // 5. Canceled auctions with Claim button
                        renderCanceledAuctions(),
                        
                        // 6. Control Panel (owner only, at bottom)
                        renderAdminPanel()
                    )
            )
        );
    };

    
    window.addEventListener('load', async () => {
        if (window.ethereum && window.ethereum.selectedAddress) {
            try {
                await connectWallet();
            } catch (e) {
                console.warn('Auto-connect failed:', e);
            }
        }
    });


    // Initial render
    renderApp();
