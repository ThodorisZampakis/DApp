// Web3 Integration Module
// Handles MetaMask connection and web3 provider setup

const Web3Integration = {
    web3: null,
    account: null,
    networkId: null,
    isConnected: false,
    
    // Initialize Web3
    async init() {
        if (!window.ethereum) {
            this.web3 = null;
            this.account = null;
            this.networkId = null;
            this.isConnected = false;
            throw new Error('MetaMask extension not found');
        }

        try {
            // Request account access
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            this.web3 = new Web3(window.ethereum);
            this.isConnected = true;
            
            // Get current account
            const accounts = await this.web3.eth.getAccounts();
            this.account = accounts[0] || null;
            if (!this.account) {
                throw new Error('No account connected');
            }
            
            // Get network ID
            this.networkId = await this.web3.eth.net.getId();
            
            // Setup event listeners
            this.setupEventListeners();
            
            return true;
        } catch (error) {
            this.web3 = null;
            this.account = null;
            this.networkId = null;
            this.isConnected = false;
            console.error('Failed to connect to MetaMask:', error);
            throw error;
        }
    },
    
    // Setup MetaMask event listeners
    setupEventListeners() {
        if (!window.ethereum) {
            return;
        }
        // Account change
     if (window.ethereum) {
   window.ethereum.on('accountsChanged', (accounts) => {
    if (accounts.length === 0) {
        Web3Integration.account = null;
        Web3Integration.isConnected = false;
        Web3Integration.onDisconnect?.();
    } else {
        Web3Integration.account = accounts[0];   // 🔴 ΤΟ ΚΡΙΣΙΜΟ
        Web3Integration.isConnected = true;
        Web3Integration.onAccountChange?.(accounts[0]);
    }
});

}


        
        // Network change
        window.ethereum.on('chainChanged', (chainId) => {
            window.location.reload();
        });
        
        // Disconnect
        window.ethereum.on('disconnect', (error) => {
            console.error('MetaMask disconnected:', error);
            this.isConnected = false;
            this.onDisconnect();
        });
    },
    
    // Event callbacks (to be overridden)
    onAccountChange: function(account) {
        // This will be overridden by the main app
        console.log('Account changed:', account);
    },
    
    onDisconnect: function() {
        // This will be overridden by the main app
        console.log('Disconnected from MetaMask');
    },
    
    // Get current account
    async getCurrentAccount() {
        if (!this.isConnected) return null;
        
        try {
            const accounts = await this.web3.eth.getAccounts();
            this.account = accounts[0];
            return this.account;
        } catch (error) {
            console.error('Failed to get current account:', error);
            return null;
        }
    },
    
    // Check if connected to correct network (Sepolia)
    isCorrectNetwork() {
        return this.networkId === 11155111; // Sepolia testnet
    },
    
    // Switch to Sepolia network
    async switchToSepolia() {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0xaa36a7' }], // Sepolia chain ID
            });
            return true;
        } catch (switchError) {
            // This error code indicates that the chain has not been added to MetaMask
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [
                            {
                                chainId: '0xaa36a7',
                                chainName: 'Sepolia Testnet',
                                rpcUrls: ['https://sepolia.infura.io/v3/'],
                                blockExplorerUrls: ['https://sepolia.etherscan.io'],
                                nativeCurrency: {
                                    name: 'ETH',
                                    symbol: 'ETH',
                                    decimals: 18,
                                },
                            },
                        ],
                    });
                    return true;
                } catch (addError) {
                    console.error('Failed to add Sepolia network:', addError);
                    return false;
                }
            } else {
                console.error('Failed to switch to Sepolia network:', switchError);
                return false;
            }
        }
    },
    
    // Get balance - HARDENED: Never call with null/undefined address
    async getBalance(address = null) {
        // GUARD: Must be connected
        if (!this.isConnected) return '0';
        if (!this.web3) return '0';
        
        // GUARD: Resolve address - NEVER call with null/undefined
        const targetAddress = address || this.account;
        if (!targetAddress) {
            console.warn('getBalance called with no address');
            return '0';
        }
        
        try {
            const balance = await this.web3.eth.getBalance(targetAddress);
            return this.web3.utils.fromWei(balance, 'ether');
        } catch (error) {
            console.error('Failed to get balance:', error);
            return '0';
        }
    },
    
    // REMOVED: sendTransaction function
    // Plain ETH transactions should NEVER be sent to contract address
    // This would trigger receive()/fallback() which revert if msg.value < auctionFee
    // All contract interactions MUST go through ContractManager methods with proper ABI encoding
    
    // Get transaction receipt
    async getTransactionReceipt(txHash) {
        if (!this.isConnected) return null;
        
        try {
            const receipt = await this.web3.eth.getTransactionReceipt(txHash);
            return receipt;
        } catch (error) {
            console.error('Failed to get transaction receipt:', error);
            return null;
        }
    },
    
    // Wait for transaction
    async waitForTransaction(txHash, maxWaitTime = 60000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            const receipt = await this.getTransactionReceipt(txHash);
            if (receipt) {
                return receipt;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        throw new Error('Transaction timeout');
    },
    
    // Convert ETH to Wei
    toWei(ether) {
        if (!this.web3) return '0';
        return this.web3.utils.toWei(ether.toString(), 'ether');
    },
    
    // Convert Wei to ETH
    fromWei(wei) {
        if (!this.web3) return '0';
        return this.web3.utils.fromWei(wei.toString(), 'ether');
    },
    
    // Format address
    formatAddress(address) {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    },
    
    // Format balance
    formatBalance(balance) {
        const num = parseFloat(balance);
        if (isNaN(num)) return '0 ETH';
        return `${num.toFixed(4)} ETH`;
    },
    
    // Check if address is valid
    isValidAddress(address) {
        if (!this.web3) return false;
        return this.web3.utils.isAddress(address);
    },
    
    // Get gas price
    async getGasPrice() {
        if (!this.isConnected) return '0';
        
        try {
            const gasPrice = await this.web3.eth.getGasPrice();
            return gasPrice;
        } catch (error) {
            console.error('Failed to get gas price:', error);
            return '0';
        }
    },
    
    // Estimate gas
    async estimateGas(to, data = '0x', from = null) {
        if (!this.isConnected) return '0';
        
        try {
            const gas = await this.web3.eth.estimateGas({
                to: to,
                data: data,
                from: from || this.account,
            });
            return gas;
        } catch (error) {
            console.error('Failed to estimate gas:', error);
            return '0';
        }
    }
};

// Export for use in other modules
window.Web3Integration = Web3Integration;
