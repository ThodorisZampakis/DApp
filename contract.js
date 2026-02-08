// Contract Interaction Module
// STRICT SYNC with deployed Sepolia contract - NO invented functions
// GUARD: No contract interaction before wallet connection

const ContractManager = {
    contract: null,
    contractAddress: null,
    eventListeners: [],
    isInitialized: false,
    
    // GUARD: Check if safe to make contract calls
    _checkReady() {
        if (!this.isInitialized) {
            throw new Error('Contract not initialized');
        }
        if (!this.contract) {
            throw new Error('Contract instance not available');
        }
        if (!Web3Integration.isConnected) {
            throw new Error('Web3 not connected');
        }
        if (!Web3Integration.account) {
            throw new Error('No account connected');
        }
    },
    
    // ABI from deployed Sepolia contract ONLY
    abi: [
        // EVENTS
        {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"auctionId","type":"uint256"},{"indexed":true,"internalType":"address","name":"seller","type":"address"},{"indexed":false,"internalType":"string","name":"description","type":"string"},{"indexed":false,"internalType":"uint256","name":"startPrice","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"endTime","type":"uint256"}],"name":"AuctionCreated","type":"event"},
        {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"auctionId","type":"uint256"},{"indexed":true,"internalType":"address","name":"bidder","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"newHighestBid","type":"uint256"}],"name":"BidPlaced","type":"event"},
        {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"auctionId","type":"uint256"},{"indexed":true,"internalType":"address","name":"seller","type":"address"},{"indexed":false,"internalType":"string","name":"reason","type":"string"}],"name":"AuctionCanceled","type":"event"},
        {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"auctionId","type":"uint256"},{"indexed":true,"internalType":"address","name":"seller","type":"address"},{"indexed":true,"internalType":"address","name":"winner","type":"address"},{"indexed":false,"internalType":"uint256","name":"finalPrice","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"sellerAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"contractFee","type":"uint256"}],"name":"AuctionFulfilled","type":"event"},
        {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"ClaimExecuted","type":"event"},
        {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"WithdrawExecuted","type":"event"},
        {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"seller","type":"address"}],"name":"SellerBanned","type":"event"},
        {"anonymous":false,"inputs":[],"name":"ContractDestroyed","type":"event"},
        {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"oldOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnerChanged","type":"event"},
        
        // PUBLIC STATE VARIABLES
        {"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"permanentOwner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"auctionFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"destroyed","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"auctionCounter","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"totalAuctions","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"totalRevenue","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
        
        // PUBLIC MAPPINGS
        {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"auctions","outputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"address payable","name":"seller","type":"address"},{"internalType":"string","name":"description","type":"string"},{"internalType":"uint256","name":"startPrice","type":"uint256"},{"internalType":"uint256","name":"highestBid","type":"uint256"},{"internalType":"address payable","name":"highestBidder","type":"address"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bool","name":"active","type":"bool"},{"internalType":"bool","name":"fulfilled","type":"bool"},{"internalType":"bool","name":"canceled","type":"bool"},{"internalType":"uint256","name":"bidCount","type":"uint256"}],"stateMutability":"view","type":"function"},
        {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"pendingReturns","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
        {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"bannedSellers","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
        {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"bannedUsers","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
        
        // VIEW FUNCTIONS
        {"inputs":[{"internalType":"uint256","name":"_auctionId","type":"uint256"}],"name":"getAuction","outputs":[{"internalType":"address","name":"seller","type":"address"},{"internalType":"string","name":"description","type":"string"},{"internalType":"uint256","name":"startPrice","type":"uint256"},{"internalType":"uint256","name":"highestBid","type":"uint256"},{"internalType":"address","name":"highestBidder","type":"address"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bool","name":"active","type":"bool"},{"internalType":"bool","name":"fulfilled","type":"bool"},{"internalType":"bool","name":"canceled","type":"bool"},{"internalType":"uint256","name":"bidCount","type":"uint256"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"getActiveAuctions","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"getFulfilledAuctions","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},
        {"inputs":[],"name":"getCanceledAuctions","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},
        {"inputs":[{"internalType":"address","name":"_addr","type":"address"}],"name":"isOwnerOrPermanent","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
        
        // STATE-CHANGING FUNCTIONS
{"inputs":[{"internalType":"string","name":"_description","type":"string"},{"internalType":"uint256","name":"_startPrice","type":"uint256"},{"internalType":"uint256","name":"_duration","type":"uint256"}],"name":"createAuction","outputs":[],"stateMutability":"payable","type":"function"},

        {"inputs":[{"internalType":"uint256","name":"_auctionId","type":"uint256"}],"name":"placeBid","outputs":[],"stateMutability":"payable","type":"function"},
        {"inputs":[{"internalType":"uint256","name":"_auctionId","type":"uint256"},{"internalType":"string","name":"_reason","type":"string"}],"name":"cancelAuction","outputs":[],"stateMutability":"nonpayable","type":"function"},
        {"inputs":[{"internalType":"uint256","name":"_auctionId","type":"uint256"}],"name":"fulfillAuction","outputs":[],"stateMutability":"nonpayable","type":"function"},
        {"inputs":[],"name":"claim","outputs":[],"stateMutability":"nonpayable","type":"function"},
        {"inputs":[],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},
        {"inputs":[{"internalType":"address","name":"_seller","type":"address"}],"name":"banSeller","outputs":[],"stateMutability":"nonpayable","type":"function"},
        {"inputs":[{"internalType":"address","name":"_newOwner","type":"address"}],"name":"changeOwner","outputs":[],"stateMutability":"nonpayable","type":"function"},
        {"inputs":[],"name":"destroy","outputs":[],"stateMutability":"nonpayable","type":"function"}
    ],
    
    // Initialize contract - ONLY call after wallet connected and network verified
    async init(contractAddress) {
        // Hard guard: Must have connected wallet first
        if (!Web3Integration.isConnected) {
            throw new Error('Web3 not connected - connect wallet first');
        }
        if (!Web3Integration.account) {
            throw new Error('No account - connect wallet first');
        }
        if (!Web3Integration.web3) {
            throw new Error('Web3 instance not available');
        }
        
        this.contractAddress = contractAddress;
        // Create contract instance - this does NOT send any transaction
        this.contract = new Web3Integration.web3.eth.Contract(this.abi, contractAddress);
        this.isInitialized = true;
        
        // Setup event listeners - also does NOT send transactions
        this.setupEventListeners();
        
        return this.contract;
    },
    
    // Reset contract state (on disconnect)
    reset() {
        this.contract = null;
        this.contractAddress = null;
        this.isInitialized = false;
        this.eventListeners = [];
    },
    
    // Setup event listeners for contract events
    // University Assignment: ALL UI updates driven by events
    setupEventListeners() {
        if (!this.contract) return;
        
        // AuctionCreated event
        this.contract.events.AuctionCreated()
            .on('data', (event) => {
                this.onAuctionCreated(event.returnValues);
            })
            .on('error', (error) => {
                console.error('AuctionCreated event error:', error);
            });
        
        // BidPlaced event
        this.contract.events.BidPlaced()
            .on('data', (event) => {
                this.onBidPlaced(event.returnValues);
            })
            .on('error', (error) => {
                console.error('BidPlaced event error:', error);
            });
        
        // AuctionCanceled event
        this.contract.events.AuctionCanceled()
            .on('data', (event) => {
                this.onAuctionCanceled(event.returnValues);
            })
            .on('error', (error) => {
                console.error('AuctionCanceled event error:', error);
            });
        
        // AuctionFulfilled event
        this.contract.events.AuctionFulfilled()
            .on('data', (event) => {
                this.onAuctionFulfilled(event.returnValues);
            })
            .on('error', (error) => {
                console.error('AuctionFulfilled event error:', error);
            });
        
        // ClaimExecuted event (MANDATORY per spec)
        this.contract.events.ClaimExecuted()
            .on('data', (event) => {
                this.onClaimExecuted(event.returnValues);
            })
            .on('error', (error) => {
                console.error('ClaimExecuted event error:', error);
            });
        
        // WithdrawExecuted event (MANDATORY per spec)
        this.contract.events.WithdrawExecuted()
            .on('data', (event) => {
                this.onWithdrawExecuted(event.returnValues);
            })
            .on('error', (error) => {
                console.error('WithdrawExecuted event error:', error);
            });
        
        // SellerBanned event (MANDATORY per spec)
        this.contract.events.SellerBanned()
            .on('data', (event) => {
                this.onSellerBanned(event.returnValues);
            })
            .on('error', (error) => {
                console.error('SellerBanned event error:', error);
            });
        
        // ContractDestroyed event (MANDATORY per spec)
        this.contract.events.ContractDestroyed()
            .on('data', (event) => {
                this.onContractDestroyed(event.returnValues);
            })
            .on('error', (error) => {
                console.error('ContractDestroyed event error:', error);
            });
        
        // OwnerChanged event
        this.contract.events.OwnerChanged()
            .on('data', (event) => {
                this.onOwnerChanged(event.returnValues);
            })
            .on('error', (error) => {
                console.error('OwnerChanged event error:', error);
            });
    },
    
    // EVENT CALLBACKS
    onAuctionCreated: function(data) {
        console.log('AuctionCreated:', data);
    },
    
    onBidPlaced: function(data) {
        console.log('BidPlaced:', data);
    },
    
    onAuctionCanceled: function(data) {
        console.log('AuctionCanceled:', data);
    },
    
    onAuctionFulfilled: function(data) {
        console.log('AuctionFulfilled:', data);
    },
    
    onClaimExecuted: function(data) {
        console.log('ClaimExecuted:', data);
    },
    
    onWithdrawExecuted: function(data) {
        console.log('WithdrawExecuted:', data);
    },
    
    onSellerBanned: function(data) {
        console.log('SellerBanned:', data);
    },
    
    onContractDestroyed: function(data) {
        console.log('ContractDestroyed:', data);
    },
    
    onOwnerChanged: function(data) {
        console.log('OwnerChanged:', data);
    },
    
    // CONTRACT WRITE METHODS - all use _checkReady() guard
    // IMPORTANT: Only placeBid includes value - others have NO value to avoid fallback
    
    async createAuction(description, startPrice, durationHours) {
        this._checkReady();
        const startPriceWei = Web3Integration.toWei(startPrice);
        const auctionFee = await this.contract.methods.auctionFee().call();
        // Hours → seconds
        const durationSeconds = Number(durationHours) * 3600;
        if (durationSeconds < 3600) {
            throw new Error('Duration must be at least 1 hour');
        }
        return await this.contract.methods
            .createAuction(description, startPriceWei, durationSeconds)
            .send({ from: Web3Integration.account, value: auctionFee });
    },
    
    // placeBid: uses existing pendingReturns toward the bid (per spec)
    // Bidder only pays the difference between desired bid and funds already in contract
    async placeBid(auctionId, bidAmount) {
        this._checkReady();
        const bidAmountWei = Web3Integration.toWei(bidAmount);
        // Fetch existing pending returns to use toward this bid
        const pendingWei = await this.contract.methods.pendingReturns(Web3Integration.account).call();
        // Calculate actual ETH to send (desired bid minus existing funds)
        const bid = BigInt(bidAmountWei);
        const pending = BigInt(pendingWei);
        const toSend = bid > pending ? (bid - pending).toString() : '0';
        return await this.contract.methods.placeBid(auctionId)
            .send({ from: Web3Integration.account, value: toSend });
    },
    
    async cancelAuction(auctionId, reason) {
        this._checkReady();
        // NO value parameter - this is nonpayable
        return await this.contract.methods.cancelAuction(auctionId, reason)
            .send({ from: Web3Integration.account });
    },
    
    async fulfillAuction(auctionId) {
        this._checkReady();
        // NO value parameter - this is nonpayable
        return await this.contract.methods.fulfillAuction(auctionId)
            .send({ from: Web3Integration.account });
    },
    
    async claim() {
        this._checkReady();
        // NO value parameter - this is nonpayable
        return await this.contract.methods.claim()
            .send({ from: Web3Integration.account });
    },
    
    async withdraw() {
        this._checkReady();
        // NO value parameter - this is nonpayable
        return await this.contract.methods.withdraw()
            .send({ from: Web3Integration.account });
    },
    
    async banSeller(sellerAddress) {
        this._checkReady();
        // NO value parameter - this is nonpayable
        return await this.contract.methods.banSeller(sellerAddress)
            .send({ from: Web3Integration.account });
    },
    
    async changeOwner(newOwner) {
        this._checkReady();
        // NO value parameter - this is nonpayable
        return await this.contract.methods.changeOwner(newOwner)
            .send({ from: Web3Integration.account });
    },
    
    // Destroy contract (permanent owner only)
    async destroy() {
        this._checkReady();
        if (!this.contract) throw new Error('Contract not initialized');
        
        try {
            const result = await this.contract.methods.destroy()
                .send({ from: Web3Integration.account });
            
            return result;
        } catch (error) {
            console.error('Failed to destroy contract:', error);
            throw error;
        }
    },
    
    // Read methods
    
    // Get auction details
    async getAuction(auctionId) {
        this._checkReady();
        if (!this.contract) throw new Error('Contract not initialized');
        
        try {
            const result = await this.contract.methods.getAuction(auctionId).call();
            return {
                seller: result[0],
                description: result[1],
                startPrice: Web3Integration.fromWei(result[2]),
                highestBid: Web3Integration.fromWei(result[3]),
                highestBidder: result[4],
                endTime: parseInt(result[5]),
                active: result[6],
                fulfilled: result[7],
                canceled: result[8],
                bidCount: parseInt(result[9])
            };
        } catch (error) {
            console.error('Failed to get auction:', error);
            throw error;
        }
    },
    
    // Get active auctions
    async getActiveAuctions() {
        this._checkReady();
        if (!this.contract) throw new Error('Contract not initialized');
        
        try {
            const result = await this.contract.methods.getActiveAuctions().call();
            return result.map(id => parseInt(id));
        } catch (error) {
            console.error('Failed to get active auctions:', error);
            throw error;
        }
    },
    
    // Get fulfilled auctions
    async getFulfilledAuctions() {
        this._checkReady();
        if (!this.contract) throw new Error('Contract not initialized');
        
        try {
            const result = await this.contract.methods.getFulfilledAuctions().call();
            return result.map(id => parseInt(id));
        } catch (error) {
            console.error('Failed to get fulfilled auctions:', error);
            throw error;
        }
    },
    
    // Get canceled auctions
    async getCanceledAuctions() {
        this._checkReady();
        if (!this.contract) throw new Error('Contract not initialized');
        
        try {
            const result = await this.contract.methods.getCanceledAuctions().call();
            return result.map(id => parseInt(id));
        } catch (error) {
            console.error('Failed to get canceled auctions:', error);
            throw error;
        }
    },
    
    // Get pending returns (uses pendingReturns mapping)
    async getPendingReturns(userAddress = null) {
        this._checkReady();
        if (!this.contract) throw new Error('Contract not initialized');
        
        try {
            const result = await this.contract.methods.pendingReturns(userAddress || Web3Integration.account).call();
            return Web3Integration.fromWei(result);
        } catch (error) {
            console.error('Failed to get pending returns:', error);
            throw error;
        }
    },
    
    // Get contract info
    async getContractInfo() {
        this._checkReady();

        try {
            const [owner, permanentOwner, auctionFee, destroyed, totalRevenueWei, balanceWei] = await Promise.all([
                this.contract.methods.owner().call(),
                this.contract.methods.permanentOwner().call(),
                this.contract.methods.auctionFee().call(),
                this.contract.methods.destroyed().call(),
                this.contract.methods.totalRevenue().call(),
                Web3Integration.web3.eth.getBalance(this.contractAddress)
            ]);

            return {
                owner,
                permanentOwner,
                auctionFee: Web3Integration.fromWei(auctionFee),
                destroyed,
                totalRevenue: Web3Integration.fromWei(totalRevenueWei),
                balance: Web3Integration.fromWei(balanceWei)
            };
        } catch (error) {
            console.error('Failed to get contract info:', error);
            throw error;
        }
    }
,
    
    // Check if user is banned (uses banned mapping)
    async isBanned(userAddress = null) {
        this._checkReady();
        if (!this.contract) throw new Error('Contract not initialized');
        
        try {
            const addr = userAddress || Web3Integration.account;
            const [isSellerBanned, isUserBanned] = await Promise.all([
                this.contract.methods.bannedSellers(addr).call(),
                this.contract.methods.bannedUsers(addr).call()
            ]);
            return Boolean(isSellerBanned || isUserBanned);
        } catch (error) {
            console.error('Failed to check ban status:', error);
            throw error;
        }
    },
    
    // REMOVED: isOwnerOrPermanent() — roles computed locally in loadContractInfo()
    // from contractInfo.owner / contractInfo.permanentOwner vs current account
    
    // Check if contract is destroyed
    async isDestroyed() {
        this._checkReady();
        if (!this.contract) throw new Error('Contract not initialized');
        
        try {
            const result = await this.contract.methods.destroyed().call();
            return result;
        } catch (error) {
            console.error('Failed to check destroyed status:', error);
            throw error;
        }
    }
};

// Export for use in other modules
window.ContractManager = ContractManager;
