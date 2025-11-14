import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { JSX, useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';
import { ethers } from 'ethers';

interface InsurancePolicy {
  id: number;
  name: string;
  drivingScore: string;
  premiumDiscount: string;
  timestamp: number;
  creator: string;
  publicValue1: number;
  publicValue2: number;
  isVerified?: boolean;
  decryptedValue?: number;
  encryptedValueHandle?: string;
}

interface PremiumAnalysis {
  basePremium: number;
  finalDiscount: number;
  riskLevel: number;
  safetyScore: number;
  totalSavings: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingPolicy, setCreatingPolicy] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending" as const, 
    message: "" 
  });
  const [newPolicyData, setNewPolicyData] = useState({ name: "", drivingScore: "", basePremium: "" });
  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(null);
  const [decryptedData, setDecryptedData] = useState<{ drivingScore: number | null; premiumDiscount: number | null }>({ drivingScore: null, premiumDiscount: null });
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showStats, setShowStats] = useState(true);

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting} = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected) {
        return;
      }
      
      if (isInitialized) {
        return;
      }
      
      if (fhevmInitializing) {
        return;
      }
      
      try {
        setFhevmInitializing(true);
        console.log('Initializing FHEVM after wallet connection...');
        await initialize();
        console.log('FHEVM initialized successfully');
      } catch (error) {
        console.error('Failed to initialize FHEVM:', error);
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed. Please check your wallet connection." 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const policiesList: InsurancePolicy[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          policiesList.push({
            id: parseInt(businessId.replace('policy-', '')) || Date.now(),
            name: businessData.name,
            drivingScore: businessId,
            premiumDiscount: businessId,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading business data:', e);
        }
      }
      
      setPolicies(policiesList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const testAvailability = async () => {
    if (!isConnected) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    try {
      const contract = await getContractReadOnly();
      if (!contract) throw new Error("Failed to get contract");
      
      const isAvailable = await contract.isAvailable();
      setTransactionStatus({ visible: true, status: "success", message: "Contract is available and ready!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Availability check failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const createPolicy = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingPolicy(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating insurance policy with Zama FHE..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const drivingScoreValue = parseInt(newPolicyData.drivingScore) || 0;
      const businessId = `policy-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, drivingScoreValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newPolicyData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        parseInt(newPolicyData.basePremium) || 0,
        0,
        "Encrypted Driving Behavior Insurance Policy"
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction confirmation..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Insurance policy created successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewPolicyData({ name: "", drivingScore: "", basePremium: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected by user" 
        : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingPolicy(false); 
    }
  };

  const decryptData = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Data already verified on-chain" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption on-chain..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "Data decrypted and verified successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Data is already verified on-chain" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        await loadData();
        return null;
      }
      
      setTransactionStatus({ 
        visible: true, 
        status: "error", 
        message: "Decryption failed: " + (e.message || "Unknown error") 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const analyzePremium = (policy: InsurancePolicy, decryptedDrivingScore: number | null, decryptedDiscount: number | null): PremiumAnalysis => {
    const drivingScore = policy.isVerified ? (policy.decryptedValue || 0) : (decryptedDrivingScore || policy.publicValue1 || 50);
    const basePremium = policy.publicValue1 || 1000;
    
    const discountRate = Math.min(50, Math.max(0, (drivingScore - 50) * 1.5));
    const finalDiscount = Math.round(basePremium * discountRate / 100);
    const riskLevel = Math.max(1, Math.min(10, Math.round((100 - drivingScore) / 10)));
    const safetyScore = Math.min(100, Math.max(0, drivingScore));
    const totalSavings = finalDiscount;

    return {
      basePremium,
      finalDiscount,
      riskLevel,
      safetyScore,
      totalSavings
    };
  };

  const renderStatistics = () => {
    const totalPolicies = policies.length;
    const verifiedPolicies = policies.filter(p => p.isVerified).length;
    const avgDiscount = policies.length > 0 
      ? policies.reduce((sum, p) => sum + p.publicValue1, 0) / policies.length 
      : 0;
    
    const recentPolicies = policies.filter(p => 
      Date.now()/1000 - p.timestamp < 60 * 60 * 24 * 7
    ).length;

    return (
      <div className="stats-panels">
        <div className="stat-panel gold-panel">
          <div className="stat-icon">📊</div>
          <h3>Total Policies</h3>
          <div className="stat-value">{totalPolicies}</div>
          <div className="stat-trend">+{recentPolicies} this week</div>
        </div>
        
        <div className="stat-panel silver-panel">
          <div className="stat-icon">🔐</div>
          <h3>FHE Verified</h3>
          <div className="stat-value">{verifiedPolicies}/{totalPolicies}</div>
          <div className="stat-trend">Encrypted & Verified</div>
        </div>
        
        <div className="stat-panel bronze-panel">
          <div className="stat-icon">💰</div>
          <h3>Avg Savings</h3>
          <div className="stat-value">${avgDiscount.toFixed(0)}</div>
          <div className="stat-trend">Per Policy</div>
        </div>
      </div>
    );
  };

  const renderPremiumChart = (policy: InsurancePolicy, decryptedDrivingScore: number | null, decryptedDiscount: number | null) => {
    const analysis = analyzePremium(policy, decryptedDrivingScore, decryptedDiscount);
    
    return (
      <div className="premium-chart">
        <div className="chart-row">
          <div className="chart-label">Base Premium</div>
          <div className="chart-bar">
            <div 
              className="bar-fill premium" 
              style={{ width: `${Math.min(100, analysis.basePremium / 20)}%` }}
            >
              <span className="bar-value">${analysis.basePremium}</span>
            </div>
          </div>
        </div>
        <div className="chart-row">
          <div className="chart-label">Discount Applied</div>
          <div className="chart-bar">
            <div 
              className="bar-fill discount" 
              style={{ width: `${Math.min(100, analysis.finalDiscount / 10)}%` }}
            >
              <span className="bar-value">-${analysis.finalDiscount}</span>
            </div>
          </div>
        </div>
        <div className="chart-row">
          <div className="chart-label">Safety Score</div>
          <div className="chart-bar">
            <div 
              className="bar-fill safety" 
              style={{ width: `${analysis.safetyScore}%` }}
            >
              <span className="bar-value">{analysis.safetyScore}/100</span>
            </div>
          </div>
        </div>
        <div className="chart-row">
          <div className="chart-label">Risk Level</div>
          <div className="chart-bar">
            <div 
              className="bar-fill risk" 
              style={{ width: `${analysis.riskLevel * 10}%` }}
            >
              <span className="bar-value">{analysis.riskLevel}/10</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFHEProcess = () => {
    return (
      <div className="fhe-process">
        <div className="process-step">
          <div className="step-icon">🔒</div>
          <div className="step-content">
            <h4>Drive Data Encryption</h4>
            <p>Driving behavior encrypted with Zama FHE 🔐</p>
          </div>
        </div>
        <div className="process-arrow">→</div>
        <div className="process-step">
          <div className="step-icon">📡</div>
          <div className="step-content">
            <h4>Secure Transmission</h4>
            <p>Encrypted data stored on-chain privately</p>
          </div>
        </div>
        <div className="process-arrow">→</div>
        <div className="process-step">
          <div className="step-icon">⚡</div>
          <div className="step-content">
            <h4>Homomorphic Calculation</h4>
            <p>Premium discount computed on encrypted data</p>
          </div>
        </div>
        <div className="process-arrow">→</div>
        <div className="process-step">
          <div className="step-icon">🔓</div>
          <div className="step-content">
            <h4>Secure Decryption</h4>
            <p>Only final result revealed to user</p>
          </div>
        </div>
      </div>
    );
  };

  const faqItems = [
    {
      question: "What is FHE in insurance pricing?",
      answer: "Fully Homomorphic Encryption allows premium calculations on encrypted driving data without exposing personal information."
    },
    {
      question: "Is my driving data tracked?",
      answer: "No, only encrypted scores are processed. No GPS or personal data is stored or tracked."
    },
    {
      question: "How are discounts calculated?",
      answer: "Discounts are computed homomorphically based on encrypted safety scores. Better driving = Higher discounts."
    },
    {
      question: "What data is encrypted?",
      answer: "Only integer driving scores are encrypted. Base premiums and final results remain visible for transparency."
    }
  ];

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>AutoPrice_Z 🔐</h1>
            <span>Confidential Insurance Pricing</span>
          </div>
          <div className="header-actions">
            <div className="wallet-connect-wrapper">
              <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
            </div>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">🚗</div>
            <h2>Connect Your Wallet to Start</h2>
            <p>Secure your privacy with FHE-encrypted insurance pricing. No tracking, just fair premiums.</p>
            <div className="connection-steps">
              <div className="step">
                <span>1</span>
                <p>Connect your wallet securely</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>FHE system initializes automatically</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>Get your encrypted premium quote</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing FHE Encryption System...</p>
        <p>Status: {fhevmInitializing ? "Initializing FHEVM" : status}</p>
        <p className="loading-note">Securing your privacy with homomorphic encryption</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Loading encrypted insurance system...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>AutoPrice_Z 🔐</h1>
          <span>FHE-Protected Insurance</span>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-btn metal-btn"
          >
            + New Policy
          </button>
          <button 
            onClick={testAvailability}
            className="test-btn metal-btn"
          >
            Test FHE
          </button>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>
      
      <div className="main-content-container">
        <div className="control-panel">
          <button 
            className={`panel-btn ${showStats ? 'active' : ''}`}
            onClick={() => setShowStats(true)}
          >
            📊 Statistics
          </button>
          <button 
            className={`panel-btn ${!showStats ? 'active' : ''}`}
            onClick={() => setShowFAQ(true)}
          >
            ❓ FAQ
          </button>
        </div>

        {showStats ? (
          <div className="dashboard-section">
            <h2>FHE Insurance Analytics 🔐</h2>
            {renderStatistics()}
            
            <div className="info-panel gold-panel">
              <h3>Homomorphic Pricing Flow</h3>
              {renderFHEProcess()}
            </div>
          </div>
        ) : (
          <div className="faq-section">
            <h2>FHE Insurance FAQ</h2>
            <div className="faq-list">
              {faqItems.map((item, index) => (
                <div key={index} className="faq-item metal-panel">
                  <h4>Q: {item.question}</h4>
                  <p>A: {item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="policies-section">
          <div className="section-header">
            <h2>Insurance Policies</h2>
            <div className="header-actions">
              <button 
                onClick={loadData} 
                className="refresh-btn metal-btn" 
                disabled={isRefreshing}
              >
                {isRefreshing ? "🔄 Refreshing..." : "🔄 Refresh"}
              </button>
            </div>
          </div>
          
          <div className="policies-list">
            {policies.length === 0 ? (
              <div className="no-policies">
                <p>No insurance policies found</p>
                <button 
                  className="create-btn metal-btn" 
                  onClick={() => setShowCreateModal(true)}
                >
                  Create First Policy
                </button>
              </div>
            ) : policies.map((policy, index) => (
              <div 
                className={`policy-item ${selectedPolicy?.id === policy.id ? "selected" : ""} ${policy.isVerified ? "verified" : ""}`} 
                key={index}
                onClick={() => setSelectedPolicy(policy)}
              >
                <div className="policy-title">{policy.name}</div>
                <div className="policy-meta">
                  <span>Base Premium: ${policy.publicValue1}</span>
                  <span>Created: {new Date(policy.timestamp * 1000).toLocaleDateString()}</span>
                </div>
                <div className="policy-status">
                  Status: {policy.isVerified ? "✅ FHE Verified" : "🔓 Ready for FHE"}
                  {policy.isVerified && policy.decryptedValue && (
                    <span className="verified-score">Safety: {policy.decryptedValue}/100</span>
                  )}
                </div>
                <div className="policy-creator">Creator: {policy.creator.substring(0, 6)}...{policy.creator.substring(38)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {showCreateModal && (
        <ModalCreatePolicy 
          onSubmit={createPolicy} 
          onClose={() => setShowCreateModal(false)} 
          creating={creatingPolicy} 
          policyData={newPolicyData} 
          setPolicyData={setNewPolicyData}
          isEncrypting={isEncrypting}
        />
      )}
      
      {selectedPolicy && (
        <PolicyDetailModal 
          policy={selectedPolicy} 
          onClose={() => { 
            setSelectedPolicy(null); 
            setDecryptedData({ drivingScore: null, premiumDiscount: null }); 
          }} 
          decryptedData={decryptedData} 
          setDecryptedData={setDecryptedData} 
          isDecrypting={isDecrypting || fheIsDecrypting} 
          decryptData={() => decryptData(selectedPolicy.drivingScore)}
          renderPremiumChart={renderPremiumChart}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && <div className="success-icon">✓</div>}
              {transactionStatus.status === "error" && <div className="error-icon">✗</div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModalCreatePolicy: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  policyData: any;
  setPolicyData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, creating, policyData, setPolicyData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'drivingScore') {
      const intValue = value.replace(/[^\d]/g, '');
      setPolicyData({ ...policyData, [name]: intValue });
    } else {
      setPolicyData({ ...policyData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="create-policy-modal">
        <div className="modal-header">
          <h2>New Insurance Policy</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice gold-panel">
            <strong>FHE 🔐 Privacy Protection</strong>
            <p>Driving score encrypted with Zama FHE. No tracking, just fair pricing.</p>
          </div>
          
          <div className="form-group">
            <label>Policy Holder Name *</label>
            <input 
              type="text" 
              name="name" 
              value={policyData.name} 
              onChange={handleChange} 
              placeholder="Enter your name..." 
            />
          </div>
          
          <div className="form-group">
            <label>Driving Safety Score (0-100) *</label>
            <input 
              type="number" 
              name="drivingScore" 
              value={policyData.drivingScore} 
              onChange={handleChange} 
              placeholder="Enter safety score..." 
              step="1"
              min="0"
              max="100"
            />
            <div className="data-type-label">FHE Encrypted Integer</div>
          </div>
          
          <div className="form-group">
            <label>Base Premium Amount ($) *</label>
            <input 
              type="number" 
              min="100" 
              name="basePremium" 
              value={policyData.basePremium} 
              onChange={handleChange} 
              placeholder="Enter base premium..." 
            />
            <div className="data-type-label">Public Data</div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn metal-btn">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={creating || isEncrypting || !policyData.name || !policyData.drivingScore || !policyData.basePremium} 
            className="submit-btn gold-btn"
          >
            {creating || isEncrypting ? "Encrypting and Creating..." : "Create Policy"}
          </button>
        </div>
      </div>
    </div>
  );
};

const PolicyDetailModal: React.FC<{
  policy: InsurancePolicy;
  onClose: () => void;
  decryptedData: { drivingScore: number | null; premiumDiscount: number | null };
  setDecryptedData: (value: { drivingScore: number | null; premiumDiscount: number | null }) => void;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
  renderPremiumChart: (policy: InsurancePolicy, decryptedDrivingScore: number | null, decryptedDiscount: number | null) => JSX.Element;
}> = ({ policy, onClose, decryptedData, setDecryptedData, isDecrypting, decryptData, renderPremiumChart }) => {
  const handleDecrypt = async () => {
    if (decryptedData.drivingScore !== null) { 
      setDecryptedData({ drivingScore: null, premiumDiscount: null }); 
      return; 
    }
    
    const decrypted = await decryptData();
    if (decrypted !== null) {
      setDecryptedData({ drivingScore: decrypted, premiumDiscount: decrypted });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="policy-detail-modal">
        <div className="modal-header">
          <h2>Insurance Policy Details</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="policy-info">
            <div className="info-item">
              <span>Policy Holder:</span>
              <strong>{policy.name}</strong>
            </div>
            <div className="info-item">
              <span>Creator:</span>
              <strong>{policy.creator.substring(0, 6)}...{policy.creator.substring(38)}</strong>
            </div>
            <div className="info-item">
              <span>Date Created:</span>
              <strong>{new Date(policy.timestamp * 1000).toLocaleDateString()}</strong>
            </div>
            <div className="info-item">
              <span>Base Premium:</span>
              <strong>${policy.publicValue1}</strong>
            </div>
          </div>
          
          <div className="data-section">
            <h3>Encrypted Safety Data</h3>
            
            <div className="data-row">
              <div className="data-label">Driving Safety Score:</div>
              <div className="data-value">
                {policy.isVerified && policy.decryptedValue ? 
                  `${policy.decryptedValue}/100 (FHE Verified)` : 
                  decryptedData.drivingScore !== null ? 
                  `${decryptedData.drivingScore}/100 (Decrypted)` : 
                  "🔒 FHE Encrypted Score"
                }
              </div>
              <button 
                className={`decrypt-btn ${(policy.isVerified || decryptedData.drivingScore !== null) ? 'decrypted' : ''}`}
                onClick={handleDecrypt} 
                disabled={isDecrypting}
              >
                {isDecrypting ? (
                  "🔓 Verifying..."
                ) : policy.isVerified ? (
                  "✅ FHE Verified"
                ) : decryptedData.drivingScore !== null ? (
                  "🔄 Re-verify"
                ) : (
                  "🔓 FHE Verify"
                )}
              </button>
            </div>
            
            <div className="fhe-info gold-panel">
              <div className="fhe-icon">🔐</div>
              <div>
                <strong>Zero-Knowledge Premium Calculation</strong>
                <p>Your driving data stays encrypted. Discounts computed homomorphically without exposing personal information.</p>
              </div>
            </div>
          </div>
          
          {(policy.isVerified || decryptedData.drivingScore !== null) && (
            <div className="analysis-section">
              <h3>Premium Analysis</h3>
              {renderPremiumChart(
                policy, 
                policy.isVerified ? policy.decryptedValue || null : decryptedData.drivingScore, 
                null
              )}
              
              <div className="decrypted-values">
                <div className="value-item">
                  <span>Safety Score:</span>
                  <strong>
                    {policy.isVerified ? 
                      `${policy.decryptedValue}/100 (FHE Verified)` : 
                      `${decryptedData.drivingScore}/100 (Decrypted)`
                    }
                  </strong>
                  <span className={`data-badge ${policy.isVerified ? 'verified' : 'local'}`}>
                    {policy.isVerified ? 'FHE Verified' : 'Local Decryption'}
                  </span>
                </div>
                <div className="value-item">
                  <span>Base Premium:</span>
                  <strong>${policy.publicValue1}</strong>
                  <span className="data-badge public">Public Data</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn metal-btn">Close</button>
          {!policy.isVerified && (
            <button 
              onClick={handleDecrypt} 
              disabled={isDecrypting}
              className="verify-btn gold-btn"
            >
              {isDecrypting ? "FHE Verifying..." : "FHE Verify"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;


