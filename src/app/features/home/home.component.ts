import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LogoComponent } from '../../shared/logo/logo.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, LogoComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {

  statusMessages = [
    'Mind map generated',
    'Notes ready to download',
    'YouTube summary created',
    'PDF summarized instantly',
    'Quiz generated from video',
    'Key points extracted',
    'Study notes exported',
    'Mind map saved',
    'Code + visuals ready',
    'PDF chat session started',
    'DSA topic visualized',
    'Document analyzed',
    'History saved',
    'Chat with PDF'
  ];
  statusIndex = 0;
  private statusTimer?: ReturnType<typeof setInterval>;

  readonly featureNames = [
    'AI Mind Map Generator',
    'YouTube AI Assistant',
    'File Summarizer',
    'Chat with PDF',
    'AI Study Chat'
  ];

  ngOnInit(): void {
    this.statusTimer = setInterval(() => {
      this.statusIndex = (this.statusIndex + 1) % this.statusMessages.length;
    }, 2400);
  }

  ngOnDestroy(): void {
    if (this.statusTimer) clearInterval(this.statusTimer);
  }
}
