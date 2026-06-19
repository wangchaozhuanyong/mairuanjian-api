export interface CreateUserDto {
  username: string;
  password: string;
  displayName: string;
  phone?: string;
  email?: string;
  roleIds?: string[];
}
