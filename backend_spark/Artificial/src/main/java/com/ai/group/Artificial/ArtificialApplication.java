// src/main/java/com/ai/group/Artificial/ArtificialApplication.java
package com.ai.group.Artificial;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.boot.autoconfigure.domain.EntityScan;
@SpringBootApplication
@EnableJpaRepositories({
		"com.ai.group.Artificial.chat.repository",
		"com.ai.group.Artificial.admin.repository"
})
@EntityScan({
		"com.ai.group.Artificial.chat.model",
		"com.ai.group.Artificial.admin.model"
})
public class ArtificialApplication {
	public static void main(String[] args) {
		SpringApplication.run(ArtificialApplication.class, args);
	}
}
