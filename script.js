// script.js

// Import auth and db from firebase-init.js, and loadUserData/updateGameButtonStates from auth.js
import { auth, db } from './firebase-init.js'; 
import { loadUserData, updateGameButtonStates } from './auth.js'; // Import functions from auth.js
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js"; 
import { doc, getDoc, updateDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

console.log("script.js loaded.");

// --- Common Modal Elements (for index.html) ---
const confirmEntryModal = document.getElementById('confirmEntryModal');
const purchaseSuccessfulModal = document.getElementById('purchaseSuccessfulModal');
const insufficientBalanceModal = document.getElementById('insufficientBalanceModal'); 
const confirmPayBtn = document.getElementById('confirm-pay-btn');
const awesomeBtn = document.getElementById('awesome-btn');

// --- Elements inside Confirm Entry Modal ---
const modalGameTitle = document.getElementById('modal-game-title');
const modalGameValue = document.getElementById('modal-game-value');
const modalEntryFee = document.getElementById('modal-entry-fee');
const modalCurrentBalance = document.getElementById('modal-current-balance');
const modalBalanceAfter = document.getElementById('modal-balance-after');
const currentBalanceDisplay = document.getElementById('current-balance-display'); 
const greetingTitle = document.getElementById('greeting-title'); 
const modalProductImage = document.getElementById('modal-product-image'); // NEW: Get modal product image element

// Global variable to hold the specific "Play Now" button that was clicked
let currentPlayingGameButton = null;

// Helper function to show a modal
function showModal(modalElement) {
    if (modalElement) { 
        modalElement.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling background
    }
}

// Helper function to hide a modal
function hideModal(modalElement) {
    if (modalElement) { 
        modalElement.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }
}

// --- Universal Modal Closing Logic ---
document.querySelectorAll('.close-modal-btn').forEach(button => {
    button.addEventListener('click', (event) => {
        const modalToClose = event.target.closest('.modal-content').parentElement;
        hideModal(modalToClose);
        if (modalToClose.id === 'confirmEntryModal' || modalToClose.id === 'insufficientBalanceModal') {
            currentPlayingGameButton = null; 
        }
        console.log("Modal closed by button:", modalToClose.id);
    });
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) { 
            hideModal(overlay);
            if (overlay.id === 'confirmEntryModal' || overlay.id === 'insufficientBalanceModal') {
                currentPlayingGameButton = null;
            }
            console.log("Modal closed by overlay click:", overlay.id);
        }
    });
});

// --- Game Play Logic (on index.html) ---
if (window.location.pathname.includes('index.html')) { 
    console.log("Index.html specific scripts are running (script.js).");
    const playNowButtons = document.querySelectorAll('.game-action-btn.play-now-btn');

    playNowButtons.forEach(button => {
        button.addEventListener('click', async (event) => { 
            currentPlayingGameButton = event.target; 
            console.log("Play Now button clicked for:", currentPlayingGameButton.dataset.gameTitle);

            const gameId = currentPlayingGameButton.dataset.gameId; 
            const gameTitle = currentPlayingGameButton.dataset.gameTitle;
            const gameValue = currentPlayingGameButton.dataset.gameValue;
            // NEW: Robust entryFee parsing, default to 0 if not a number or missing
            const rawEntryFee = currentPlayingGameButton.dataset.gameEntryFee;
            const entryFee = parseFloat(rawEntryFee) || 0.00; // Defaults to 0 if NaN

            // NEW: Get image URL for the modal
            const gameImageSrc = currentPlayingGameButton.dataset.gameImage;


            const user = auth.currentUser;
            if (!user) {
                console.log("User not logged in. Redirecting to login.");
                window.location.href = 'login.html'; 
                return;
            }

            let currentBalance = window.currentUserData ? window.currentUserData.balance : 0;
            
            // --- Pre-check balance before showing Confirm Entry modal ---
            if (currentBalance < entryFee) {
                console.log("Insufficient balance detected (pre-check). Current:", currentBalance, "Fee:", entryFee);
                hideModal(confirmEntryModal); 
                showModal(insufficientBalanceModal);
                currentPlayingGameButton = null; 
                return; 
            }

            modalGameTitle.textContent = gameTitle;
            modalGameValue.textContent = gameValue;
            modalEntryFee.textContent = `Rs. ${entryFee.toFixed(2)}`;
            modalCurrentBalance.textContent = `Rs. ${currentBalance.toFixed(2)}`;

            let balanceAfter = currentBalance - entryFee;
            modalBalanceAfter.textContent = `Rs. ${balanceAfter.toFixed(2)}`;

            // NEW: Update modal's product image src
            if (modalProductImage && gameImageSrc) {
                modalProductImage.src = gameImageSrc;
                modalProductImage.alt = gameTitle; // Also set alt text for accessibility
            } else if (modalProductImage) { // Fallback if image not provided
                 modalProductImage.src = "https://via.placeholder.com/60?text=Product";
                 modalProductImage.alt = "Generic product image";
            }

            confirmPayBtn.textContent = `Confirm & Pay Rs. ${entryFee.toFixed(2)}`;
            confirmPayBtn.dataset.entryFee = entryFee;
            confirmPayBtn.dataset.gameTitle = gameTitle;
            confirmPayBtn.dataset.gameId = gameId; 

            showModal(confirmEntryModal);
            console.log("Confirm Entry modal shown.");
        });
    });

    confirmPayBtn.addEventListener('click', async () => { 
        console.log("Confirm & Pay button clicked.");
        // NEW: Robust entryFee parsing from dataset (which should be number already)
        const entryFee = parseFloat(confirmPayBtn.dataset.entryFee) || 0.00;
        const gameTitle = confirmPayBtn.dataset.gameTitle;
        const gameId = confirmPayBtn.dataset.gameId; 

        const user = auth.currentUser;
        if (!user) { 
            console.log("User not logged in during confirm pay.");
            window.location.href = 'login.html';
            return;
        }

        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
            console.error("User document not found during payment confirmation.");
            alert("User data missing. Please try logging in again.");
            hideModal(confirmEntryModal);
            currentPlayingGameButton = null;
            return;
        }
        let currentBalance = typeof userDoc.data().Balance === 'number' ? userDoc.data().Balance : 0;
        
        if (currentBalance >= entryFee) {
            const newBalance = currentBalance - entryFee;

            try {
                await updateDoc(userDocRef, {
                    Balance: newBalance,
                    [`playedGames.${gameId}`]: true 
                });
                console.log(`Balance and playedGames updated in Firestore for UID ${user.uid}: New Balance ${newBalance}, Game ${gameId} played.`);

                currentBalanceDisplay.textContent = `Rs. ${newBalance.toFixed(2)}`;
                window.currentUserData.balance = newBalance; 
                window.currentUserData.playedGames[gameId] = true; 
                
                updateGameButtonStates(window.currentUserData.playedGames); // Update UI
                
                hideModal(confirmEntryModal);
                showModal(purchaseSuccessfulModal);
                console.log("Purchase Successful modal shown.");

                console.log(`Successfully paid Rs. ${entryFee.toFixed(2)} for ${gameTitle}. New balance: Rs. ${newBalance.toFixed(2)}`);
                currentPlayingGameButton = null; 
            } catch (error) {
                console.error("Error updating balance/playedGames in Firestore:", error);
                alert("Failed to process payment. Please try again.");
                hideModal(confirmEntryModal);
                currentPlayingGameButton = null;
            }
        } else {
            console.log("Insufficient balance detected (post-check). Current:", currentBalance, "Fee:", entryFee);
            hideModal(confirmEntryModal); 
            showModal(insufficientBalanceModal); 
            currentPlayingGameButton = null;
        }
    });

    awesomeBtn.addEventListener('click', () => {
        hideModal(purchaseSuccessfulModal);
        currentPlayingGameButton = null; 
        console.log("Awesome button clicked, success modal hidden.");
    });
}


// --- Add Cash Page Logic (on add-cash.html) ---
if (window.location.pathname.includes('add-cash.html')) {
    const addCashForm = document.querySelector('.add-cash-form');
    const copyButtons = document.querySelectorAll('.copy-btn');

    const paymentSubmittedModal = document.getElementById('paymentSubmittedModal');
    const submittedAmountDisplay = document.getElementById('submitted-amount-display');
    const submittedOkBtn = document.getElementById('submitted-ok-btn'); 

    if (addCashForm) { 
        console.log("Add-cash.html specific scripts are running (script.js).");

        copyButtons.forEach(button => {
            button.addEventListener('click', async (event) => {
                const targetId = event.currentTarget.dataset.target;
                const textToCopy = document.getElementById(targetId).textContent;

                try {
                    await navigator.clipboard.writeText(textToCopy);
                    console.log('Text copied to clipboard:', textToCopy);
                    
                    const originalIcon = event.currentTarget.querySelector('.fas').className;
                    event.currentTarget.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    event.currentTarget.classList.add('copied');

                    setTimeout(() => {
                        event.currentTarget.innerHTML = `<i class="${originalIcon}"></i>`;
                        event.currentTarget.classList.remove('copied');
                    }, 1500);
                    
                } catch (err) {
                    console.error('Failed to copy text: ', err);
                    alert('Failed to copy number. Please try manually.');
                }
            });
        });

        addCashForm.addEventListener('submit', async (event) => { 
            event.preventDefault(); 
            console.log("Add Cash form submitted.");

            const amount = parseFloat(document.getElementById('amount').value); 
            const senderAccountName = document.getElementById('sender-account-name').value;
            const senderAccountNumber = document.getElementById('sender-account-number').value;
            const transactionId = document.getElementById('transaction-id').value;

            if (!amount || !senderAccountName || !senderAccountNumber || !transactionId) {
                alert('Please fill in all required fields.');
                return;
            }

            const user = auth.currentUser;
            if (!user) {
                alert("You must be logged in to submit a payment request.");
                console.log("User not logged in for add cash submission, redirecting to login.");
                window.location.href = 'login.html';
                return;
            }

            try {
                await addDoc(collection(db, "paymentRequests"), {
                    "Account name": senderAccountName,
                    "Account number": senderAccountNumber,
                    Amount: amount, 
                    "Payment request": "Pending", 
                    "Transaction ID": transactionId,
                    "Requested By UID": user.uid, 
                    "Request Time": new Date() 
                });

                console.log('Add Cash Request Submitted to Firestore:', {
                    amount, senderAccountName, senderAccountNumber, transactionId, requestedBy: user.uid
                });

                if (submittedAmountDisplay) { submittedAmountDisplay.textContent = amount.toFixed(2); }
                showModal(paymentSubmittedModal);
                addCashForm.reset(); 
                console.log("Payment Submitted modal shown, form reset.");
            } catch (error) {
                console.error("Error submitting payment request to Firestore:", error);
                alert("Failed to submit payment request. Please try again.");
            }
        });

        if (submittedOkBtn) {
            submittedOkBtn.addEventListener('click', () => {
                hideModal(paymentSubmittedModal);
                console.log("Payment Submitted modal hidden by OK button.");
            });
        }
    }
}


// --- Announcement Page Logic (on announcement.html) ---
if (window.location.pathname.includes('announcement.html')) {
    console.log("Announcement.html specific scripts are running (script.js).");
    // No specific script.js logic needed yet for the announcements content itself
}
