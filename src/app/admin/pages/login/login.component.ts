import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ThemeToggleComponent } from '../../../shared/theme-toggle.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, ThemeToggleComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  showPassword = false;
  structure = 'hmgr';

  constructor(private router: Router) {}

  login(): void {
    this.router.navigateByUrl('/admin/tableau-de-bord');
  }
}
