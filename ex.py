# PyTorch-only environment check
import torch


def main():
    print("Torch version:", torch.__version__)
    print("Torch CUDA version:", torch.version.cuda)
    print("CUDA available:", torch.cuda.is_available())
    if torch.cuda.is_available():
        print("GPU device count:", torch.cuda.device_count())
        for i in range(torch.cuda.device_count()):
            print(f" - Device {i}: {torch.cuda.get_device_name(i)}")
    else:
        print("Using CPU")


if __name__ == "__main__":
    main()