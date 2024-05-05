import {Component} from '@angular/core';
import {Store} from '@ngrx/store';
import {AppState} from "../../store/state/AppState";
import {selectCardId} from "../../store/selectors/card.selector";
import {setCardId} from "../../store/actions/card.actions";
import {OutlayService} from "../../services/outlay-service";

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent {
  cardId$ = this.store.select(selectCardId);
  clientToken: string = '';

  constructor(private store: Store<AppState>, private outlayService: OutlayService) {
  }

  submitSettings() {
    this.registerUser(this.clientToken);
    console.log(this.cardId$);
  }

  registerUser(token: string) {
    console.log(token);
    this.outlayService.registerUser(token).subscribe((x) => this.store.dispatch(setCardId({id: x.toString()})));
  }
}
