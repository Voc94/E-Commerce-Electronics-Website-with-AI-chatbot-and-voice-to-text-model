// com/ai/group/Artificial/admin/AdminRequestRepository.java
package com.ai.group.Artificial.admin.repository;

import com.ai.group.Artificial.admin.model.AdminRequest;
import com.ai.group.Artificial.admin.model.AdminRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AdminRequestRepository extends JpaRepository<AdminRequest, UUID> {

    Optional<AdminRequest> findTopByUserIdAndStatusOrderByCreatedAtDesc(
            UUID userId, AdminRequestStatus status
    );

    List<AdminRequest> findAllByStatusOrderByCreatedAtAsc(AdminRequestStatus status);
    @Query("""
        select r from AdminRequest r
         where r.status = 'ACCEPTED'
           and (r.userId = :id or r.acceptedBy = :id)
    """)
    List<AdminRequest> findAllOpenByParticipant(@Param("id") UUID id);
}
