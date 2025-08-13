package com.storesight.backend.repository;

import com.storesight.backend.model.DPIARecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DPIARecordRepository extends JpaRepository<DPIARecord, Long> {}
