import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LogoComponent } from '../logo/logo.component';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, LogoComponent],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css'
})
export class FooterComponent {}
