#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#include "SDL.h"

static const char* tok_names[] = {
  "GP_A","GP_B","GP_X","GP_Y",
  "GP_L1","GP_R1",
  "GP_START","GP_SELECT",
  "GP_DPAD_UP","GP_DPAD_DOWN","GP_DPAD_LEFT","GP_DPAD_RIGHT",
  "GP_L2","GP_R2",
  "GP_L3","GP_R3",
  "GP_LS_LEFT","GP_LS_RIGHT","GP_LS_UP","GP_LS_DOWN",
  "GP_RS_LEFT","GP_RS_RIGHT","GP_RS_UP","GP_RS_DOWN",
};

typedef enum {
  TOK_GP_A = 0, TOK_GP_B, TOK_GP_X, TOK_GP_Y,
  TOK_GP_L1, TOK_GP_R1,
  TOK_GP_START, TOK_GP_SELECT,
  TOK_GP_DPAD_UP, TOK_GP_DPAD_DOWN, TOK_GP_DPAD_LEFT, TOK_GP_DPAD_RIGHT,
  TOK_GP_L2, TOK_GP_R2,
  TOK_GP_L3, TOK_GP_R3,
  TOK_GP_LS_LEFT, TOK_GP_LS_RIGHT, TOK_GP_LS_UP, TOK_GP_LS_DOWN,
  TOK_GP_RS_LEFT, TOK_GP_RS_RIGHT, TOK_GP_RS_UP, TOK_GP_RS_DOWN,
  TOK__COUNT
} Token;

static SDL_GameControllerButton controller_button_for_token(Token t) {
  switch (t) {
    case TOK_GP_A: return SDL_CONTROLLER_BUTTON_A;
    case TOK_GP_B: return SDL_CONTROLLER_BUTTON_B;
    case TOK_GP_X: return SDL_CONTROLLER_BUTTON_X;
    case TOK_GP_Y: return SDL_CONTROLLER_BUTTON_Y;

    case TOK_GP_L1: return SDL_CONTROLLER_BUTTON_LEFTSHOULDER;
    case TOK_GP_R1: return SDL_CONTROLLER_BUTTON_RIGHTSHOULDER;

    case TOK_GP_START: return SDL_CONTROLLER_BUTTON_START;
    case TOK_GP_SELECT: return SDL_CONTROLLER_BUTTON_BACK;

    case TOK_GP_L3: return SDL_CONTROLLER_BUTTON_LEFTSTICK;
    case TOK_GP_R3: return SDL_CONTROLLER_BUTTON_RIGHTSTICK;

    case TOK_GP_DPAD_UP: return SDL_CONTROLLER_BUTTON_DPAD_UP;
    case TOK_GP_DPAD_DOWN: return SDL_CONTROLLER_BUTTON_DPAD_DOWN;
    case TOK_GP_DPAD_LEFT: return SDL_CONTROLLER_BUTTON_DPAD_LEFT;
    case TOK_GP_DPAD_RIGHT: return SDL_CONTROLLER_BUTTON_DPAD_RIGHT;

    default: return SDL_CONTROLLER_BUTTON_INVALID;
  }
}

static SDL_GameControllerAxis controller_axis_for_token(Token t, int* out_sign) {
  switch (t) {
    case TOK_GP_LS_LEFT:  *out_sign = -1; return SDL_CONTROLLER_AXIS_LEFTX;
    case TOK_GP_LS_RIGHT: *out_sign = +1; return SDL_CONTROLLER_AXIS_LEFTX;
    case TOK_GP_LS_UP:    *out_sign = -1; return SDL_CONTROLLER_AXIS_LEFTY;
    case TOK_GP_LS_DOWN:  *out_sign = +1; return SDL_CONTROLLER_AXIS_LEFTY;

    case TOK_GP_RS_LEFT:  *out_sign = -1; return SDL_CONTROLLER_AXIS_RIGHTX;
    case TOK_GP_RS_RIGHT: *out_sign = +1; return SDL_CONTROLLER_AXIS_RIGHTX;
    case TOK_GP_RS_UP:    *out_sign = -1; return SDL_CONTROLLER_AXIS_RIGHTY;
    case TOK_GP_RS_DOWN:  *out_sign = +1; return SDL_CONTROLLER_AXIS_RIGHTY;

    case TOK_GP_L2: *out_sign = +1; return SDL_CONTROLLER_AXIS_TRIGGERLEFT;
    case TOK_GP_R2: *out_sign = +1; return SDL_CONTROLLER_AXIS_TRIGGERRIGHT;

    default: return SDL_CONTROLLER_AXIS_INVALID;
  }
}

static void print_json_string(const char* s) {
  putchar('"');
  for (const char* p = s; *p; p++) {
    if (*p == '"' || *p == '\\') { putchar('\\'); putchar(*p); }
    else if (*p == '\n') { fputs("\\n", stdout); }
    else putchar(*p);
  }
  putchar('"');
}

static int axis_index_for(SDL_GameController* gc, SDL_GameControllerAxis ax, int* out_axis_index) {
  SDL_GameControllerButtonBind b = SDL_GameControllerGetBindForAxis(gc, ax);
  if (b.bindType != SDL_CONTROLLER_BINDTYPE_AXIS) return 0;
  *out_axis_index = b.value.axis;
  return 1;
}

static int button_index_for(SDL_GameController* gc, SDL_GameControllerButton btn, int* out_button_index) {
  SDL_GameControllerButtonBind b = SDL_GameControllerGetBindForButton(gc, btn);
  if (b.bindType != SDL_CONTROLLER_BINDTYPE_BUTTON) return 0;
  *out_button_index = b.value.button;
  return 1;
}

static const char* az_threshold_token(int sign) {
  return (sign < 0) ? "-0.5" : "0.500";
}

static int build_stick_blob_azahar(
  char* out, size_t out_sz,
  SDL_GameController* gc,
  SDL_GameControllerAxis ax_x,
  SDL_GameControllerAxis ax_y,
  SDL_GameControllerButton modifier_btn,
  const char* guid,
  int port
) {
  int xAxis = -1, yAxis = -1, modButton = -1;
  if (!axis_index_for(gc, ax_x, &xAxis)) return 0;
  if (!axis_index_for(gc, ax_y, &yAxis)) return 0;

  int hasMod = button_index_for(gc, modifier_btn, &modButton);

  if (hasMod) {
    snprintf(out, out_sz,
      "down:axis$%02d$1direction$0+$1engine$0sdl$1guid$0%s$1port$0%d$1threshold$0%s,"
      "engine:analog_from_button,"
      "left:axis$%02d$1direction$0-$1engine$0sdl$1guid$0%s$1port$0%d$1threshold$0%s,"
      "modifier:button$%02d$1engine$0sdl$1guid$0%s$1port$0%d,"
      "modifier_scale:0.500000,"
      "right:axis$%02d$1direction$0+$1engine$0sdl$1guid$0%s$1port$0%d$1threshold$0%s,"
      "up:axis$%02d$1direction$0-$1engine$0sdl$1guid$0%s$1port$0%d$1threshold$0%s",
      yAxis, guid, port, az_threshold_token(+1),
      xAxis, guid, port, az_threshold_token(-1),
      modButton, guid, port,
      xAxis, guid, port, az_threshold_token(+1),
      yAxis, guid, port, az_threshold_token(-1)
    );
  } else {
    snprintf(out, out_sz,
      "down:axis$%02d$1direction$0+$1engine$0sdl$1guid$0%s$1port$0%d$1threshold$0%s,"
      "engine:analog_from_button,"
      "left:axis$%02d$1direction$0-$1engine$0sdl$1guid$0%s$1port$0%d$1threshold$0%s,"
      "right:axis$%02d$1direction$0+$1engine$0sdl$1guid$0%s$1port$0%d$1threshold$0%s,"
      "up:axis$%02d$1direction$0-$1engine$0sdl$1guid$0%s$1port$0%d$1threshold$0%s",
      yAxis, guid, port, az_threshold_token(+1),
      xAxis, guid, port, az_threshold_token(-1),
      xAxis, guid, port, az_threshold_token(+1),
      yAxis, guid, port, az_threshold_token(-1)
    );
  }

  out[out_sz - 1] = '\0';
  return out[0] != '\0';
}

int main(int argc, char** argv) {
  int desired_index = -1;

  for (int i = 1; i < argc; i++) {
    if (strcmp(argv[i], "--index") == 0 && i + 1 < argc) {
      desired_index = atoi(argv[i + 1]);
      i++;
    }
  }

  if (SDL_Init(SDL_INIT_GAMECONTROLLER | SDL_INIT_JOYSTICK) != 0) {
    fprintf(stderr, "SDL_Init failed: %s\n", SDL_GetError());
    return 2;
  }

  int num = SDL_NumJoysticks();
  int chosen = -1;

  if (desired_index >= 0 && desired_index < num && SDL_IsGameController(desired_index)) {
    chosen = desired_index;
  } else {
    for (int i = 0; i < num; i++) {
      if (SDL_IsGameController(i)) { chosen = i; break; }
    }
  }

  if (chosen < 0) {
    printf("{\"ok\":false,\"error\":\"no-controller\"}\n");
    SDL_Quit();
    return 0;
  }

  SDL_GameController* gc = SDL_GameControllerOpen(chosen);
  if (!gc) {
    fprintf(stderr, "SDL_GameControllerOpen failed: %s\n", SDL_GetError());
    SDL_Quit();
    return 3;
  }

  SDL_Joystick* js = SDL_GameControllerGetJoystick(gc);
  SDL_JoystickGUID g = SDL_JoystickGetGUID(js);

  char guid_str[64];
  SDL_JoystickGetGUIDString(g, guid_str, (int)sizeof(guid_str));

  printf("{\"ok\":true,\"guid\":");
  print_json_string(guid_str);
  printf(",\"port\":0,\"binds\":{");

  int first = 1;

  for (int t = 0; t < TOK__COUNT; t++) {
    Token tok = (Token)t;

    SDL_GameControllerButton b = controller_button_for_token(tok);
    if (b == SDL_CONTROLLER_BUTTON_INVALID) continue;

    SDL_GameControllerButtonBind bind = SDL_GameControllerGetBindForButton(gc, b);

    if (bind.bindType == SDL_CONTROLLER_BINDTYPE_BUTTON) {
      if (!first) printf(",");
      first = 0;
      print_json_string(tok_names[t]);
      printf(":{\"kind\":\"button\",\"button\":%d}", bind.value.button);
      continue;
    }

    if (bind.bindType == SDL_CONTROLLER_BINDTYPE_HAT) {
      const char* dir = NULL;
      if (tok == TOK_GP_DPAD_UP) dir = "up";
      else if (tok == TOK_GP_DPAD_DOWN) dir = "down";
      else if (tok == TOK_GP_DPAD_LEFT) dir = "left";
      else if (tok == TOK_GP_DPAD_RIGHT) dir = "right";

      if (dir) {
        if (!first) printf(",");
        first = 0;
        print_json_string(tok_names[t]);
        printf(":{\"kind\":\"hat\",\"hat\":%d,\"direction\":", bind.value.hat.hat);
        print_json_string(dir);
        printf("}");
      }
      continue;
    }

    if (bind.bindType == SDL_CONTROLLER_BINDTYPE_AXIS) {
      int sign = 0;
      if (tok == TOK_GP_DPAD_LEFT || tok == TOK_GP_DPAD_UP) sign = -1;
      else if (tok == TOK_GP_DPAD_RIGHT || tok == TOK_GP_DPAD_DOWN) sign = +1;

      if (sign != 0) {
        if (!first) printf(",");
        first = 0;
        print_json_string(tok_names[t]);
        printf(":{\"kind\":\"axis\",\"axis\":%d,\"direction\":", bind.value.axis);
        print_json_string(sign < 0 ? "-" : "+");
        printf(",\"threshold\":0.5}");
      }
      continue;
    }
  }

  for (int t = 0; t < TOK__COUNT; t++) {
    Token tok = (Token)t;
    int sign = 0;

    SDL_GameControllerAxis ax = controller_axis_for_token(tok, &sign);
    if (ax == SDL_CONTROLLER_AXIS_INVALID) continue;

    SDL_GameControllerButtonBind bind = SDL_GameControllerGetBindForAxis(gc, ax);
    if (bind.bindType != SDL_CONTROLLER_BINDTYPE_AXIS) continue;

    if (!first) printf(",");
    first = 0;
    print_json_string(tok_names[t]);
    printf(":{\"kind\":\"axis\",\"axis\":%d,\"direction\":", bind.value.axis);
    print_json_string(sign < 0 ? "-" : "+");
    printf(",\"threshold\":0.5}");
  }

  printf("}");

  char circle_pad[4096];
  char c_stick[4096];
  int has_circle = build_stick_blob_azahar(
    circle_pad, sizeof(circle_pad),
    gc,
    SDL_CONTROLLER_AXIS_LEFTX,
    SDL_CONTROLLER_AXIS_LEFTY,
    SDL_CONTROLLER_BUTTON_LEFTSTICK,
    guid_str,
    0
  );

  int has_cstick = build_stick_blob_azahar(
    c_stick, sizeof(c_stick),
    gc,
    SDL_CONTROLLER_AXIS_RIGHTX,
    SDL_CONTROLLER_AXIS_RIGHTY,
    SDL_CONTROLLER_BUTTON_RIGHTSTICK,
    guid_str,
    0
  );

  printf(",\"sticks\":{");
  int sticks_first = 1;

  if (has_circle) {
    if (!sticks_first) printf(",");
    sticks_first = 0;
    print_json_string("circle_pad");
    printf(":");
    print_json_string(circle_pad);
  }

  if (has_cstick) {
    if (!sticks_first) printf(",");
    sticks_first = 0;
    print_json_string("c_stick");
    printf(":");
    print_json_string(c_stick);
  }

  printf("}");
  printf("}\n");

  SDL_GameControllerClose(gc);
  SDL_Quit();
  return 0;
}