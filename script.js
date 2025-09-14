// script.js

// Import auth and db from firebase-init.js
import { auth, db } from './firebase-init.js'; 
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js"; 
import { doc, getDoc, updateDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

console.log("script.js loaded.");

document.addEventListener('DOMContentLoaded', () => {
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
    // This applies to ALL modals that have a 'close-modal-btn'
    document.querySelectorAll('.close-modal-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const modalToClose = event.target.closest('.modal-content').parentElement;
            hideModal(modalToClose);
            // Clear current game button reference if a game-related modal is closed
            if (modalToClose.id === 'confirmEntryModal' || modalToClose.id === 'insufficientBalanceModal') {
                currentPlayingGameButton = null; 
            }
            console.log("Modal closed by button:", modalToClose.id);
        });
    });

    // This applies to ALL modals that are clicked outside their content
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) { // Check if the click was directly on the overlay
                hideModal(overlay);
                // Clear current game button reference if a game-related modal is closed
                if (overlay.id === 'confirmEntryModal' || overlay.id === 'insufficientBalanceModal') {
                    currentPlayingGameButton = null;
                }
                console.log("Modal closed by overlay click:", overlay.id);
            }
        });
    });

    // --- Game Play Logic (on index.html) ---
    // This block runs only if elements specific to index.html are found
    if (currentBalanceDisplay) { 
        console.log("Index.html specific scripts are running.");
        const playNowButtons = document.querySelectorAll('.game-action-btn.play-now-btn');

        playNowButtons.forEach(button => {
            button.addEventListener('click', async (event) => { // Made async for Firebase calls
                currentPlayingGameButton = event.target; // Store reference to the clicked button
                console.log("Play Now button clicked for:", currentPlayingGameButton.dataset.gameTitle);

                const gameTitle = currentPlayingGameButton.dataset.gameTitle;
                const gameValue = currentPlayingGameButton.dataset.gameValue;
                const entryFee = parseFloat(currentPlayingGameButton.dataset.gameEntryFee);

                const user = auth.currentUser;
                if (!user) {
                    console.log("User not logged in. Redirecting to login.");
                    window.location.href = 'login.html'; // Redirect to login if not authenticated
                    return;
                }

                // Get current user balance from the global variable (updated by auth.js)
                let currentBalance = window.currentUserData ? window.currentUserData.balance : 0;
                
                // --- Pre-check balance before showing Confirm Entry modal ---
                if (currentBalance < entryFee) {
                    console.log("Insufficient balance detected (pre-check). Current:", currentBalance, "Fee:", entryFee);
                    hideModal(confirmEntryModal); // Hide any open confirm modal
                    showModal(insufficientBalanceModal);
                    currentPlayingGameButton = null; // Clear reference as game wasn't initiated
                    return; // Stop further execution
                }

                modalGameTitle.textContent = gameTitle;
                modalGameValue.textContent = gameValue;
                modalEntryFee.textContent = `Rs. ${entryFee.toFixed(2)}`;
                modalCurrentBalance.textContent = `Rs. ${currentBalance.toFixed(2)}`;

                let balanceAfter = currentBalance - entryFee;
                modalBalanceAfter.textContent = `Rs. ${balanceAfter.toFixed(2)}`;

                confirmPayBtn.textContent = `Confirm & Pay Rs. ${entryFee.toFixed(2)}`;
                confirmPayBtn.dataset.entryFee = entryFee;
                confirmPayBtn.dataset.gameTitle = gameTitle;

                showModal(confirmEntryModal);
                console.log("Confirm Entry modal shown.");
            });
        });

        confirmPayBtn.addEventListener('click', async () => { // Made async for Firebase calls
            console.log("Confirm & Pay button clicked.");
            const entryFee = parseFloat(confirmPayBtn.dataset.entryFee);
            const gameTitle = confirmPayBtn.dataset.gameTitle;

            const user = auth.currentUser;
            if (!user) { 
                console.log("User not logged in during confirm pay.");
                window.location.href = 'login.html';
                return;
            }

            // Get the latest balance from the global currentUserData
            let currentBalance = window.currentUserData ? window.currentUserData.balance : 0;
            
            if (currentBalance >= entryFee) {
                const newBalance = currentBalance - entryFee;

                try {
                    // Update balance in Firestore
                    const userDocRef = doc(db, "users", user.uid);
                    await updateDoc(userDocRef, {
                        Balance: newBalance
                    });
                    console.log(`Balance updated in Firestore for UID ${user.uid}: ${newBalance}`);

                    // Update local UI
                    currentBalanceDisplay.textContent = `Rs. ${newBalance.toFixed(2)}`;
                    window.currentUserData.balance = newBalance; // Update local data
                    console.log("Local balance and currentUserData updated.");


                    if (currentPlayingGameButton) {
                        currentPlayingGameButton.textContent = 'Played';
                        currentPlayingGameButton.classList.remove('play-now-btn');
                        currentPlayingGameButton.classList.add('played-btn');
                        delete currentPlayingGameButton.dataset.gameEntryFee;
                        console.log("Game button changed to 'Played'.");
                    }

                    hideModal(confirmEntryModal);
                    showModal(purchaseSuccessfulModal);
                    console.log("Purchase Successful modal shown.");

                    console.log(`Successfully paid Rs. ${entryFee.toFixed(2)} for ${gameTitle}. New balance: Rs. ${newBalance.toFixed(2)}`);
                    currentPlayingGameButton = null; // Clear reference after success
                } catch (error) {
                    console.error("Error updating balance in Firestore:", error);
                    alert("Failed to process payment. Please try again.");
                    hideModal(confirmEntryModal);
                    currentPlayingGameButton = null;
                }
            } else {
                // This block should ideally not be hit if pre-check works, but acts as a final safeguard
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
    const addCashForm = document.querySelector('.add-cash-form');
    const copyButtons = document.querySelectorAll('.copy-btn');

    // MODAL elements for add-cash.html
    const paymentSubmittedModal = document.getElementById('paymentSubmittedModal');
    const submittedAmountDisplay = document.getElementById('submitted-amount-display');
    const submittedOkBtn = document.getElementById('submitted-ok-btn');

    if (addCashForm) { // Only run if on add-cash.html
        console.log("Add-cash.html specific scripts are running.");
        // --- Copy to Clipboard Functionality ---
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
                    }, 1500); // Revert after 1.5 seconds
                    
                } catch (err) {
                    console.error('Failed to copy text: ', err);
                    alert('Failed to copy number. Please try manually.'); // Fallback alert
                }
            });
        });

        // --- Form Submission ---
        addCashForm.addEventListener('submit', async (event) => { // Made async for Firebase calls
            event.preventDefault(); // Prevent default form submission
            console.log("Add Cash form submitted.");

            const amount = parseFloat(document.getElementById('amount').value); // Parse as float
            const senderAccountName = document.getElementById('sender-account-name').value;
            const senderAccountNumber = document.getElementById('sender-account-number').value;
            const transactionId = document.getElementById('transaction-id').value;

            // Basic client-side validation
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
                // Add document to "paymentRequests" collection
                await addDoc(collection(db, "paymentRequests"), {
                    "Account name": senderAccountName,
                    "Account number": senderAccountNumber,
                    Amount: amount, 
                    "Payment request": "Pending", // Initial status as per your image/request
                    "Transaction ID": transactionId,
                    "Requested By UID": user.uid, // Link request to the logged-in user
                    "Request Time": new Date() // Timestamp for the request
                });

                console.log('Add Cash Request Submitted to Firestore:', {
                    amount,
                    senderAccountName,
                    senderAccountNumber: senderAccountNumber,
                    transactionId,
                    requestedBy: user.uid
                });

                // Show the "Payment Submitted" modal on the current page
                if (submittedAmountDisplay) {
                    submittedAmountDisplay.textContent = amount.toFixed(2);
                }
                showModal(paymentSubmittedModal);
                addCashForm.reset(); // Clear form fields
                console.log("Payment Submitted modal shown, form reset.");
            } catch (error) {
                console.error("Error submitting payment request to Firestore:", error);
                alert("Failed to submit payment request. Please try again.");
            }
        });

        // Event listener for the "OK" button on the paymentSubmittedModal
        if (submittedOkBtn) {
            submittedOkBtn.addEventListener('click', () => {
                hideModal(paymentSubmittedModal);
                console.log("Payment Submitted modal hidden by OK button.");
            });
        }
    }
});