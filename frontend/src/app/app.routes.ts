import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ConnectionsComponent } from './components/connections/connections';
import { QueryBuilderComponent } from './components/query-builder/query-builder.component';
import { BrowseDataComponent } from './components/browser-data/browser-data.component';
import { SavedQuestionsComponent } from './components/saved-questions/saved-questions.component';
import { LoginComponent } from './components/login/login';
import { RegisterComponent } from './components/register/register';
import { AuthGuard } from './services/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/connections', pathMatch: 'full' },
  { path: 'connections', component: ConnectionsComponent, canActivate: [AuthGuard] },
  { path: 'query-builder', component: QueryBuilderComponent, canActivate: [AuthGuard] },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'query', redirectTo: 'query-builder' },
  { path: 'browse-data', component: BrowseDataComponent, canActivate: [AuthGuard] },
  { path: 'saved-questions', component: SavedQuestionsComponent, canActivate: [AuthGuard] },
];