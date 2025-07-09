package com.storesight.backend.util;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * Utility class for password operations. This is primarily used for generating BCrypt hashes for
 * admin passwords.
 */
public class PasswordUtil {

  private static final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);

  /**
   * Generate a BCrypt hash for a plain text password. Use this to generate the hashed password for
   * the ADMIN_PASSWORD environment variable.
   *
   * @param plainPassword The plain text password
   * @return The BCrypt hash
   */
  public static String hashPassword(String plainPassword) {
    return encoder.encode(plainPassword);
  }

  /**
   * Verify if a plain text password matches a BCrypt hash.
   *
   * @param plainPassword The plain text password
   * @param hashedPassword The BCrypt hash
   * @return true if the password matches the hash
   */
  public static boolean verifyPassword(String plainPassword, String hashedPassword) {
    return encoder.matches(plainPassword, hashedPassword);
  }

  /**
   * Main method to generate a hash for admin password setup. Usage: java PasswordUtil
   * <plain-password>
   */
  public static void main(String[] args) {
    if (args.length != 1) {
      System.out.println("Usage: java PasswordUtil <plain-password>");
      System.out.println("Example: java PasswordUtil mySecurePassword123");
      System.exit(1);
    }

    String plainPassword = args[0];
    String hashedPassword = hashPassword(plainPassword);

    System.out.println("=== Admin Password Setup ===");
    System.out.println("Plain password: " + plainPassword);
    System.out.println("BCrypt hash: " + hashedPassword);
    System.out.println();
    System.out.println("Set the following environment variable:");
    System.out.println("ADMIN_PASSWORD=" + hashedPassword);
    System.out.println();
    System.out.println("IMPORTANT: Never store the plain password in environment variables!");
    System.out.println("Only use the BCrypt hash for the ADMIN_PASSWORD environment variable.");
  }
}
