// Updated route.ts

// Allow user to cancel only when order.status === 'waiting'
// Remove 'pending' status cancel

export const cancelOrder = (id) => {
    if (order.status !== 'waiting') {
        throw new Error('Order can only be canceled if it is in waiting status.');
    }
    // Existing cancellation logic
};