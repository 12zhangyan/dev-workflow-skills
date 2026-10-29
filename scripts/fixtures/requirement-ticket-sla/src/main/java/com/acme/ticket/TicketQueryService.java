package com.acme.ticket;

import java.util.ArrayList;
import java.util.List;

public final class TicketQueryService {
    private final List<Ticket> store;

    public TicketQueryService(List<Ticket> store) {
        this.store = store;
    }

    /** Lists tickets visible to the current user: only tickets of the user's own department. */
    public List<Ticket> list(long currentUserDeptId, TicketQuery query) {
        List<Ticket> result = new ArrayList<>();
        for (Ticket ticket : store) {
            if (ticket.getDeptId() != currentUserDeptId) {
                continue;
            }
            if (query.getStatus() != null && ticket.getStatus() != query.getStatus()) {
                continue;
            }
            result.add(ticket);
        }
        return result;
    }
}
