package com.acme.ticket;

public final class TicketQuery {
    private final TicketStatus status;

    public TicketQuery(TicketStatus status) {
        this.status = status;
    }

    public TicketStatus getStatus() { return status; }
}
