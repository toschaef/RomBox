#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <SDL3/SDL.h>

static void print_json_string(const char* s) {
  if (!s) { printf("null"); return; }
  printf("\"");
  for (; *s; ++s) {
    if (*s == '"') printf("\\\"");
    else if (*s == '\\') printf("\\\\");
    else if (*s == '\n') printf("\\n");
    else if (*s == '\r') printf("\\r");
    else if (*s == '\t') printf("\\t");
    else printf("%c", *s);
  }
  printf("\"");
}

int main(int argc, char** argv) {
  int listen = 0;
  for (int i=1; i<argc; i++) {
    if (strcmp(argv[i], "--listen") == 0) listen = 1;
  }

  if (!SDL_Init(SDL_INIT_GAMEPAD | SDL_INIT_JOYSTICK)) {
    printf("{\"ok\":false,\"error\":\"SDL_Init failed\"}\n");
    return 1;
  }

  int count = 0;
  SDL_JoystickID* joysticks = SDL_GetJoysticks(&count);
  SDL_JoystickID chosen = 0;

  for (int i=0; i<count; i++) {
    if (SDL_IsGamepad(joysticks[i])) {
      chosen = joysticks[i];
      break;
    }
  }

  if (chosen == 0) {
    printf("{\"ok\":false,\"error\":\"No game controller found\"}\n");
    SDL_Quit();
    return 1;
  }

  SDL_Gamepad* gc = SDL_OpenGamepad(chosen);
  if (!gc) {
    printf("{\"ok\":false,\"error\":\"Failed to open gamepad\"}\n");
    SDL_Quit();
    return 1;
  }

  if (listen) {
    printf("{\"ok\":true,\"listen\":true,\"message\":\"Listening for button press...\"}\n");
    fflush(stdout);

    SDL_Event e;
    while (SDL_WaitEvent(&e)) {
      if (e.type == SDL_EVENT_GAMEPAD_BUTTON_DOWN) {
        printf("{\"ok\":true,\"button_pressed\":%d}\n", e.gbutton.button);
        fflush(stdout);
        break;
      }
      if (e.type == SDL_EVENT_QUIT) {
        break;
      }
    }
  } else {
    SDL_Joystick* js = SDL_GetGamepadJoystick(gc);
    SDL_GUID g = SDL_GetJoystickGUID(js);
    char guid_str[64];
    SDL_GUIDToString(g, guid_str, sizeof(guid_str));
    const char* name = SDL_GetGamepadName(gc);

    printf("{\"ok\":true,\"guid\":\"%s\",\"name\":", guid_str);
    print_json_string(name);
    printf(",\"port\":0,\"binds\":{");
    int count = 0;
    SDL_GamepadBinding **bindings = SDL_GetGamepadBindings(gc, &count);
    int first = 1;
    for (int i=0; i<count; i++) {
      SDL_GamepadBinding *b = bindings[i];
      if (b->output_type == SDL_GAMEPAD_BINDTYPE_BUTTON) {
        if (!first) printf(",");
        first = 0;
        printf("\"button_%d\":{\"kind\":\"button\",\"button\":", b->output.button);
        if (b->input_type == SDL_GAMEPAD_BINDTYPE_BUTTON) {
          printf("%d}", b->input.button);
        } else {
          printf("-1}");
        }
      }
    }
    printf("},\"sticks\":{}}\n");
  }

  SDL_CloseGamepad(gc);
  SDL_Quit();
  return 0;
}